// ========================================================
// 🧠 SENAL-MD BOT - FIXED & OPTIMIZED MAIN FILE
// ========================================================

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const {
  getBuffer,
  getGroupAdmins,
  isUrl,
  runtime,
  fetchJson
} = require('./lib/functions');

const fs = require('fs');
const P = require('pino');
const config = require('./config');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const { sms } = require('./lib/msg');
const { File } = require('megajs');
const express = require('express');
const app = express();
const port = process.env.PORT || 8000;

const prefix = '.';
const ownerNumber = ['94769872326']; // ✅ Updated owner number

// ================= SESSION AUTH =====================
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
  if (!config.SESSION_ID)
    return console.log('❌ Please add your session to SESSION_ID env !!');
  const sessdata = config.SESSION_ID;
  const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
  filer.download((err, data) => {
    if (err) throw err;
    fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
      console.log('✅ Session downloaded');
    });
  });
}

// ================= EXPRESS SERVER =====================
app.get('/', (req, res) => res.send('🟢 Senal-MD Bot Started Successfully!'));
app.listen(port, () =>
  console.log(`🌍 Server running on http://localhost:${port}`)
);

// ================= MAIN WHATSAPP CONNECTION =====================
async function connectToWA() {
  console.log('⚙️ Connecting Senal-MD Bot...');
  const { state, saveCreds } = await useMultiFileAuthState(
    __dirname + '/auth_info_baileys/'
  );
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS('Firefox'),
    auth: state,
    version
  });

  // ================= CONNECTION UPDATES =====================
  conn.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const reason =
        lastDisconnect?.error?.output?.statusCode ||
        lastDisconnect?.error?.output?.payload?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log('♻️ Reconnecting...');
        connectToWA();
      } else {
        console.log('❌ Logged out from WhatsApp');
      }
    } else if (connection === 'open') {
      console.log('✅ Bot connected to WhatsApp');
      console.log('⚙️ Installing plugins...');

      const path = require('path');
      fs.readdirSync('./plugins/').forEach((plugin) => {
        if (path.extname(plugin).toLowerCase() === '.js') {
          require('./plugins/' + plugin);
        }
      });

      console.log('✅ Plugins installed successfully');

      const caption = `✅ Senal-MD connected successfully!\n\nPrefix: ${prefix}`;
      conn.sendMessage(ownerNumber[0] + '@s.whatsapp.net', {
        image: { url: 'https://files.catbox.moe/gm88nn.png' },
        caption
      });
    }
  });

  conn.ev.on('creds.update', saveCreds);

  // ================= MESSAGE HANDLER =====================
  conn.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      const mek = chatUpdate.messages[0];
      if (!mek.message) return;

      mek.message =
        getContentType(mek.message) === 'ephemeralMessage'
          ? mek.message.ephemeralMessage.message
          : mek.message;

      const m = sms(conn, mek);
      const type = getContentType(mek.message);
      const from = mek.key.remoteJid;
      const body =
        (type === 'conversation' && mek.message.conversation) ||
        (type === 'imageMessage' && mek.message.imageMessage.caption) ||
        (type === 'videoMessage' && mek.message.videoMessage.caption) ||
        (type === 'extendedTextMessage' &&
          mek.message.extendedTextMessage.text) ||
        '';
      const isCmd = body.startsWith(prefix);
      const command = isCmd
        ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase()
        : '';
      const args = body.trim().split(/ +/).slice(1);
      const q = args.join(' ');
      const isGroup = from.endsWith('@g.us');
      const sender = mek.key.fromMe
        ? conn.user.id.split(':')[0] + '@s.whatsapp.net'
        : isGroup
        ? mek.key.participant
        : mek.key.remoteJid;
      const senderNumber = sender.split('@')[0];
      const pushname = mek.pushName || 'Unknown User';
      const botNumber2 = await jidNormalizedUser(conn.user.id);
      const isOwner =
        ownerNumber.includes(senderNumber) ||
        conn.user.id.split(':')[0].includes(senderNumber);

      const reply = async (text) =>
        await conn.sendMessage(from, { text }, { quoted: mek });

      // ================= ACCESS MODES =====================
      if (!isOwner && config.MODE === 'private') return;
      if (!isOwner && isGroup && config.MODE === 'inbox') return;
      if (!isOwner && !isGroup && config.MODE === 'groups') return;

      // ================= OWNER AUTO REACT =====================
      if (senderNumber === '94769872326' && !m.message.reactionMessage) {
        await conn.sendMessage(from, {
          react: { text: '👨‍💻', key: mek.key }
        });
      }

      // ================= AUTO VOICE (OPTIONAL) =====================
      if (config.AUTO_VOICE === 'true') {
        const url =
          'https://raw.githubusercontent.com/DarkYasiyaofc/VOICE/main/Voice-Raw/FROZEN-V2';
        let { data } = await axios.get(url);
        for (vr in data) {
          if (new RegExp(`\\b${vr}\\b`, 'gi').test(body))
            conn.sendMessage(
              from,
              { audio: { url: data[vr] }, mimetype: 'audio/mpeg', ptt: true },
              { quoted: mek }
            );
        }
      }

      // ================= COMMAND HANDLER =====================
      const events = require('./command');
      const cmd =
        events.commands.find((x) => x.pattern === command) ||
        events.commands.find(
          (x) => x.alias && x.alias.includes(command)
        );

      if (cmd) {
        if (cmd.react)
          await conn.sendMessage(from, {
            react: { text: cmd.react, key: mek.key }
          });

        try {
          await cmd.function(conn, mek, m, {
            from,
            quoted: mek,
            body,
            isCmd,
            command,
            args,
            q,
            isGroup,
            sender,
            senderNumber,
            botNumber2,
            pushname,
            isOwner,
            reply
          });
          console.log(`✅ Executed: ${command}`);
        } catch (e) {
          console.error(`❌ Command Error (${command}):`, e);
          reply('⚠️ Error executing this command.');
        }
      }
    } catch (err) {
      console.error('❌ Message Handler Error:', err);
    }
  });
}

// ========================================================
setTimeout(connectToWA, 4000);
