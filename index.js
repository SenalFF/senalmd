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

// ================== SESSION AUTH =====================
const sessionFolder = path.join(__dirname, 'auth_info_baileys');
const credsPath = path.join(sessionFolder, 'creds.json');

(async () => {
  if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder);

  if (!fs.existsSync(credsPath)) {
    if (config.SESSION_ID && config.SESSION_ID.includes('#')) {
      console.log('🌀 Downloading session from MEGA.nz...');
      try {
        const file = File.fromURL(`https://mega.nz/file/${config.SESSION_ID}`);
        const data = await file.downloadBuffer();
        fs.writeFileSync(credsPath, data);
        console.log('✅ Session downloaded successfully.');
      } catch (e) {
        console.error('❌ Failed to download session:', e.message);
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
          connectToWA();
        } else {
          console.log('❌ Logged out. Please regenerate your session.');
        }
      } else if (connection === 'open') {
        console.log('✅ Senal MD Bot Connected Successfully!');
        console.log(`👑 Owner: ${ownerNumber}`);
        console.log(`📢 Mode: ${config.MODE}`);
        console.log(`💬 Prefix: ${prefix}`);

        // Load Plugins
        fs.readdirSync('./plugins/')
          .filter(f => f.endsWith('.js'))
          .forEach(f => {
            require('./plugins/' + f);
          });

        console.log('🧩 Plugins Installed Successfully!');

        await conn.sendMessage(ownerNumber + '@s.whatsapp.net', {
          image: { url: 'https://files.catbox.moe/gm88nn.png' },
          caption: `✅ Senal-MD Connected Successfully\n\nPrefix: ${prefix}\nMode: ${config.MODE}`
        });
      }
    });

    conn.ev.on('creds.update', saveCreds);

    // ================== MESSAGE HANDLER =====================
    conn.ev.on('messages.upsert', async (mek) => {
      mek = mek.messages[0];
      if (!mek.message) return;
      mek.message = (getContentType(mek.message) === 'ephemeralMessage')
        ? mek.message.ephemeralMessage.message
        : mek.message;

      if (mek.key.remoteJid === 'status@broadcast' && config.AUTO_READ_STATUS)
        await conn.readMessages([mek.key]);

      const m = sms(conn, mek);
      const type = getContentType(mek.message);
      const content = JSON.stringify(mek.message);
      const from = mek.key.remoteJid;
      const quoted = (type === 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo)
        ? mek.message.extendedTextMessage.contextInfo.quotedMessage || []
        : [];
      const body =
        type === 'conversation' ? mek.message.conversation :
          type === 'extendedTextMessage' ? mek.message.extendedTextMessage.text :
            type === 'imageMessage' && mek.message.imageMessage.caption ?
              mek.message.imageMessage.caption :
              type === 'videoMessage' && mek.message.videoMessage.caption ?
                mek.message.videoMessage.caption : '';

      const isCmd = body.startsWith(prefix);
      const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
      const args = body.trim().split(/ +/).slice(1);
      const q = args.join(' ');
      const isGroup = from.endsWith('@g.us');
      const sender = mek.key.fromMe
        ? conn.user.id.split(':')[0] + '@s.whatsapp.net'
        : mek.key.participant || mek.key.remoteJid;
      const senderNumber = sender.split('@')[0];
      const botNumber = conn.user.id.split(':')[0];
      const pushname = mek.pushName || 'No Name';
      const isOwner = ownerNumber.includes(senderNumber);
      const botNumber2 = await jidNormalizedUser(conn.user.id);

      const reply = (text) => conn.sendMessage(from, { text }, { quoted: mek });

      // Command handling
      const events = require('./command');
      if (isCmd) {
        const cmd = events.commands.find((c) => c.pattern === command || (c.alias && c.alias.includes(command)));
        if (cmd) {
          if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
          try {
            await cmd.function(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isOwner, reply });
          } catch (e) {
            console.error('❌ Plugin Error:', e);
            reply(`❌ *Error:* ${e.message}`);
          }
        }
      }
    });
  }

  // ================== EXPRESS SERVER =====================
  app.get('/', (req, res) => res.send('✅ Senal MD is running...'));
  app.listen(port, () => console.log(`🌐 Server running at http://localhost:${port}`));

  connectToWA();
})();
