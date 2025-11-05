// main.js
// ======================= SENAL MD BOT ======================= //
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers
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
const app = express();
const prefix = config.PREFIX || '.';
const port = process.env.PORT || 8000;

const ownerNumber = [config.OWNER_NUMBER];

// command handler module (exports cmd, commands, loadPlugins)
const commandHandler = require('./command');

// ================== SESSION AUTH =====================
const sessionFolder = path.join(__dirname, 'auth_info_baileys');
const credsPath = path.join(sessionFolder, 'creds.json');

(async () => {
  if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

  if (!fs.existsSync(credsPath)) {
    if (config.SESSION_ID && config.SESSION_ID.includes('#')) {
      console.log('🌀 Downloading session from MEGA.nz...');
      try {
        const file = File.fromURL(`https://mega.nz/file/${config.SESSION_ID}`);
        const data = await file.downloadBuffer();
        fs.writeFileSync(credsPath, data);
        console.log('✅ Session downloaded successfully.');
      } catch (e) {
        console.error('❌ Failed to download session:', e.message || e);
        console.log('Please scan the QR code to create a new session.');
      }
    } else if (config.SESSION_ID && config.SESSION_ID.length > 50) {
      console.log('🧩 Using inline SESSION_ID...');
      fs.writeFileSync(credsPath, Buffer.from(config.SESSION_ID, 'utf-8'));
    } else {
      console.log('⚠️ No valid SESSION_ID found. QR code will be displayed.');
    }
  }

  // ================== WHATSAPP CONNECTION =====================
  async function connectToWA() {
    console.log('⏳ Connecting to WhatsApp...');
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
      logger: P({ level: 'silent' }),
      printQRInTerminal: true,
      browser: Browsers.macOS('Firefox'),
      auth: state,
      version,
      syncFullHistory: true
    });

    conn.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        if (reason !== DisconnectReason.loggedOut) {
          console.log('🔁 Reconnecting...');
          setTimeout(connectToWA, 2000);
        } else {
          console.log('❌ Logged out. Please regenerate your session and restart the bot.');
        }
      } else if (connection === 'open') {
        console.log('✅ Senal MD Bot Connected Successfully!');
        console.log(`👑 Owner: ${ownerNumber}`);
        console.log(`📢 Mode: ${config.MODE}`);
        console.log(`💬 Prefix: ${prefix}`);

        // Load plugins (this will require plugin files and register commands)
        commandHandler.loadPlugins();
        console.log('🧩 Plugins Installed Successfully!');

        // Notify owner (first)
        const firstOwner = ownerNumber[0];
        if (firstOwner) {
          await conn.sendMessage(firstOwner + '@s.whatsapp.net', {
            image: { url: config.ALIVE_IMG || 'https://files.catbox.moe/gm88nn.png' },
            caption: `✅ Senal-MD Connected Successfully\n\nPrefix: ${prefix}\nMode: ${config.MODE}`
          }).catch(() => { });
        }
      }
    });

    conn.ev.on('creds.update', saveCreds);

    // ================== MESSAGE HANDLER =====================
    conn.ev.on('messages.upsert', async (mek) => {
      try {
        mek = mek.messages[0];
        if (!mek) return;
        if (!mek.message) return;

        // Unwrap ephemeral
        if (getContentType(mek.message) === 'ephemeralMessage' && mek.message.ephemeralMessage) {
          mek.message = mek.message.ephemeralMessage.message;
        }

        // Auto-read status updates if enabled
        if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_READ_STATUS) {
          await conn.readMessages([mek.key]).catch(() => {});
        }

        const m = sms(conn, mek);
        const type = getContentType(mek.message);
        const from = mek.key.remoteJid;
        const quoted = (type === 'extendedTextMessage' && mek.message.extendedTextMessage?.contextInfo)
          ? (mek.message.extendedTextMessage.contextInfo.quotedMessage || [])
          : [];
        const body =
          type === 'conversation' ? mek.message.conversation :
            type === 'extendedTextMessage' ? mek.message.extendedTextMessage.text :
              (type === 'imageMessage' && mek.message.imageMessage.caption) ? mek.message.imageMessage.caption :
                (type === 'videoMessage' && mek.message.videoMessage.caption) ? mek.message.videoMessage.caption : '';

        if (!body) return;
        if (!body.startsWith(prefix)) return;

        const isCmd = true;
        const command = body.slice(prefix.length).trim().split(' ')[0].toLowerCase();
        const args = body.trim().split(/ +/).slice(1);
        const q = args.join(' ');
        const isGroup = from.endsWith('@g.us');
        const sender = mek.key.fromMe
          ? conn.user.id.split(':')[0] + '@s.whatsapp.net'
          : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];
        const pushname = mek.pushName || 'No Name';
        const isOwner = ownerNumber.includes(senderNumber);
        const botNumber2 = await jidNormalizedUser(conn.user.id);

        const reply = (text) => conn.sendMessage(from, { text }, { quoted: mek }).catch(() => { });

        // find and run matching command
        const events = commandHandler.commands;
        const cmd = events.find((c) =>
          c.pattern === command ||
          (Array.isArray(c.alias) && c.alias.includes(command))
        );

        if (cmd) {
          // react if defined
          if (cmd.react) {
            try { await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } }); } catch (e) { }
          }

          try {
            await Promise.resolve(cmd.function(conn, mek, m, {
              from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber,
              botNumber2, botNumber, pushname, isOwner, reply, getBuffer, getGroupAdmins, isUrl, fetchJson
            }));
          } catch (e) {
            console.error('❌ Plugin Error:', e);
            try { reply(`❌ *Error:* ${e.message || e}`); } catch (ignore) { }
          }
        }
      } catch (e) {
        console.error('messages.upsert handler error:', e);
      }
    });
  }

  // ================== EXPRESS SERVER =====================
  app.get('/', (req, res) => res.send('✅ Senal MD is running...'));
  app.listen(port, () => console.log(`🌐 Server running at http://localhost:${port}`));

  connectToWA();
})();
