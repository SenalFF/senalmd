// index.js (updated) - Senal MD Bot
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys');

const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions');
const fs = require('fs');
const P = require('pino');
const config = require('./config');
const qrcode = require('qrcode-terminal');
const util = require('util');
const { sms, downloadMediaMessage } = require('./lib/msg');
const axios = require('axios');
const { File } = require('megajs');
const express = require('express');
const path = require('path');
const commandHandler = require('./command'); // expects { cmd, commands, loadPlugins }

const app = express();
const port = process.env.PORT || 8000;
const prefix = config.PREFIX || '.';

// Owner(s) - support single or comma-separated in config
const ownerNumber = Array.isArray(config.OWNER_NUMBER) ? config.OWNER_NUMBER : (config.OWNER_NUMBER ? [String(config.OWNER_NUMBER)] : ['94769872326']);

// session paths
const sessionFolder = path.join(__dirname, 'auth_info_baileys');
const credsPath = path.join(sessionFolder, 'creds.json');

// ensure session folder exists
if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

// Try download session from Mega if creds not present
(async () => {
  if (!fs.existsSync(credsPath)) {
    if (config.SESSION_ID) {
      // If SESSION_ID looks like mega (contains #) treat as file id
      if (config.SESSION_ID.includes('#') || config.SESSION_ID.startsWith('https://mega.nz')) {
        console.log('🌀 Attempting to download session from MEGA.nz...');
        try {
          const url = config.SESSION_ID.startsWith('http') ? config.SESSION_ID : `https://mega.nz/file/${config.SESSION_ID}`;
          const file = File.fromURL(url);
          // megajs has downloadBuffer in some versions; fallback to callback if not available
          if (typeof file.downloadBuffer === 'function') {
            const data = await file.downloadBuffer();
            fs.writeFileSync(credsPath, data);
            console.log('✅ Session downloaded from MEGA.');
          } else {
            await new Promise((resolve, reject) => {
              file.download((err, data) => {
                if (err) return reject(err);
                fs.writeFileSync(credsPath, data);
                resolve();
              });
            });
            console.log('✅ Session downloaded from MEGA.');
          }
        } catch (err) {
          console.error('❌ Failed to download session from MEGA:', err && err.message ? err.message : err);
          console.log('You may scan QR to create a new session.');
        }
      } else if (config.SESSION_ID.length > 50) {
        // inline session token (rare)
        try {
          fs.writeFileSync(credsPath, Buffer.from(config.SESSION_ID, 'utf-8'));
          console.log('🧩 Using inline SESSION_ID and saved to creds.json');
        } catch (e) {
          console.error('❌ Failed to write inline SESSION_ID:', e);
        }
      } else {
        console.log('⚠️ SESSION_ID provided but not recognized as MEGA or inline token. Using QR as fallback.');
      }
    } else {
      console.log('⚠️ No SESSION_ID found — will use QR code for authentication.');
    }
  } else {
    console.log('🔐 Local session found — using existing credentials.');
  }
})().catch(e => console.error('Session init error:', e));

// express health
app.get('/', (req, res) => res.send('Hey, Senal started ✅'));
app.listen(port, '0.0.0.0', () => console.log(`Server listening on http://0.0.0.0:${port}`));

// ================== connect function ===================
async function connectToWA() {
  console.log('⏳ Connecting Senal MD BOT ...');
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
      logger: P({ level: 'silent' }),
      printQRInTerminal: true,
      browser: Browsers.macOS('Firefox'),
      syncFullHistory: true,
      auth: state,
      version,
    });

    // save creds when updated
    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        // show QR in terminal for manual auth if needed
        try { qrcode.generate(qr, { small: true }); } catch {}
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log('❌ connection closed:', reason);
        if (reason !== DisconnectReason.loggedOut) {
          console.log('🔁 Reconnecting in 2s...');
          setTimeout(() => connectToWA(), 2000);
        } else {
          console.log('⚠️ Logged out (DisconnectReason.loggedOut). Remove auth_info_baileys and re-authenticate.');
        }
      } else if (connection === 'open') {
        console.log('✅ Bot connected to WhatsApp ✅');

        // Load plugins via command handler (clears old commands to prevent duplicates)
        if (typeof commandHandler.loadPlugins === 'function') {
          commandHandler.loadPlugins();
        } else {
          // fallback: load plugin files manually
          const pluginDir = path.join(__dirname, 'plugins');
          if (fs.existsSync(pluginDir)) {
            fs.readdirSync(pluginDir).forEach((plugin) => {
              if (path.extname(plugin).toLowerCase() === '.js') {
                try {
                  delete require.cache[require.resolve('./plugins/' + plugin)];
                  require('./plugins/' + plugin);
                } catch (e) {
                  console.error('Plugin load error:', plugin, e);
                }
              }
            });
          }
        }

        console.log('🧩 Plugins installed successfully ✅');

        // notify owner (first)
        try {
          const firstOwner = ownerNumber[0];
          if (firstOwner) {
            const up = `Senal-MD connected successfully ✅\n\nPREFIX: ${prefix}`;
            await conn.sendMessage(firstOwner + '@s.whatsapp.net', {
              image: { url: config.ALIVE_IMG || 'https://files.catbox.moe/gm88nn.png' },
              caption: up
            });
          }
        } catch (e) {
          // ignore owner notify errors
        }
      }
    });

    // ================== messages handler ===================
    conn.ev.on('messages.upsert', async (update) => {
      try {
        const mek = update.messages?.[0];
        if (!mek || !mek.message) return;

        // ignore status broadcasts unless config wants to read them
        if (mek.key.remoteJid === 'status@broadcast' && !config.AUTO_READ_STATUS) return;

        // unwrap ephemeral
        const contentType = getContentType(mek.message);
        const msg = contentType === 'ephemeralMessage' && mek.message.ephemeralMessage
          ? mek.message.ephemeralMessage.message
          : mek.message;

        // get text body safely
        const body =
          (msg.conversation && typeof msg.conversation === 'string' && msg.conversation) ||
          (msg.extendedTextMessage && msg.extendedTextMessage.text) ||
          (msg.imageMessage && msg.imageMessage.caption) ||
          (msg.videoMessage && msg.videoMessage.caption) ||
          '';

        if (!body) {
          // optionally auto-read status updates
          if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_READ_STATUS) {
            await conn.readMessages([mek.key]).catch(() => {});
          }
          return;
        }

        const from = mek.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net') : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = String(sender).split('@')[0];
        const pushname = mek.pushName || 'No Name';
        const isOwner = ownerNumber.includes(senderNumber);
        const reply = (teks) => conn.sendMessage(from, { text: teks }, { quoted: mek }).catch(() => {});

        // auto mark as read for status when enabled
        if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_READ_STATUS) {
          await conn.readMessages([mek.key]).catch(() => {});
        }

        // ensure prefix match
        if (!body.startsWith(prefix)) return;

        const args = body.trim().split(/ +/).slice(1);
        const commandText = body.slice(prefix.length).trim().split(' ')[0].toLowerCase();
        const q = args.join(' ');

        // find matching command from command handler
        const events = commandHandler.commands || [];
        const cmd = events.find((c) => (c.pattern === commandText) || (Array.isArray(c.alias) && c.alias.includes(commandText)));

        if (!cmd) {
          // also support commands registered with "on: body" (listeners)
          // run them if needed
          const bodyListeners = events.filter(e => e.on === 'body');
          for (const listener of bodyListeners) {
            try {
              await Promise.resolve(listener.function(conn, mek, msg, {
                from, quoted: msg.extendedTextMessage?.contextInfo?.quotedMessage || [], body, isCmd: true, command: commandText, args, q, isGroup, sender, senderNumber, pushname, isOwner, reply
              }));
            } catch (e) {
              console.error('body-listener error:', e);
            }
          }
          return;
        }

        // react if configured
        if (cmd.react) {
          try { await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } }); } catch {}
        }

        // execute command
        try {
          await Promise.resolve(cmd.function(conn, mek, msg, {
            from,
            quoted: msg.extendedTextMessage?.contextInfo?.quotedMessage || [],
            body,
            isCmd: true,
            command: commandText,
            args,
            q,
            isGroup,
            sender,
            senderNumber,
            botNumber: conn.user?.id?.split(':')[0],
            pushname,
            isOwner,
            reply,
            getBuffer,
            getGroupAdmins,
            isUrl,
            fetchJson
          }));
        } catch (e) {
          console.error('[PLUGIN ERROR]', e);
          try { reply('❌ Plugin error: ' + (e.message || e)); } catch {}
        }

      } catch (e) {
        console.error('messages.upsert error:', e);
      }
    });

    return conn;
  } catch (e) {
    console.error('connectToWA failed:', e);
    setTimeout(connectToWA, 3000);
  }
}

// start bot
setTimeout(() => {
  connectToWA();
}, 4000);
