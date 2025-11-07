// ================= Required Modules =================
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const { getBuffer, getGroupAdmins, sms } = require('./lib/functions');
const fs = require('fs');
const P = require('pino');
const config = require('./config');
const axios = require('axios');
const { File } = require('megajs');
const express = require('express');
const path = require('path');
const { cmd, commands } = require('./command');

const prefix = '.';
const ownerNumber = ['94769872326'];

// ================= Mega Session Download =================
const authDir = __dirname + '/auth_info_baileys';
if (!fs.existsSync(authDir + '/creds.json')) {
  if (!config.SESSION_ID) return console.log('Please add your SESSION_ID in .env!');
  const sessdata = config.SESSION_ID;
  const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
  filer.download((err, data) => {
    if (err) throw err;
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(authDir + '/creds.json', data);
    console.log('✅ Session downloaded from Mega');
  });
}

// ================= Express Server =================
const app = express();
const port = process.env.PORT || 8000;
app.get('/', (req, res) => res.send('Hey, Senal MD started ✅'));
app.listen(port, () => console.log(`🌐 Server running at http://localhost:${port}`));

// ================= Connect WhatsApp =================
async function connectToWA() {
  console.log('🔌 Connecting Senal MD BOT ⏳...');
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS('Firefox'),
    syncFullHistory: true,
    auth: state,
    version
  });

  // ================= Connection Events =================
  conn.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      if ((lastDisconnect?.error?.output?.statusCode ?? 0) !== DisconnectReason.loggedOut) {
        console.log('⚠️ Disconnected, reconnecting...');
        connectToWA();
      } else {
        console.log('❌ Logged out, delete creds.json and re-login!');
      }
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp');
      console.log('🧩 Loading plugins...');
      fs.readdirSync('./plugins')
        .filter(file => file.endsWith('.js'))
        .forEach(plugin => require('./plugins/' + plugin));
      console.log('✅ Plugins loaded');

      let statusMsg = `Senal-MD connected successfully ✅\n\nPREFIX: ${prefix}`;
      conn.sendMessage(ownerNumber + '@s.whatsapp.net', { 
        image: { url: 'https://files.catbox.moe/gm88nn.png' }, 
        caption: statusMsg 
      });
    }
  });

  conn.ev.on('creds.update', saveCreds);

  // ================= Message Handler =================
  conn.ev.on('messages.upsert', async (mekData) => {
    try {
      let mek = mekData.messages[0];
      if (!mek.message) return;

      mek.message = (getContentType(mek.message) === 'ephemeralMessage') 
        ? mek.message.ephemeralMessage.message 
        : mek.message;

      if (mek.key.remoteJid === 'status@broadcast' && config.AUTO_READ_STATUS === 'true') {
        await conn.readMessages([mek.key]);
      }

      const m = sms(conn, mek);
      const type = getContentType(mek.message);
      const from = mek.key.remoteJid;
      const quoted = (type === 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo)
        ? mek.message.extendedTextMessage.contextInfo.quotedMessage || {}
        : {};
      const body = (type === 'conversation') ? mek.message.conversation 
        : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text
        : (type === 'imageMessage') ? mek.message.imageMessage.caption || ''
        : (type === 'videoMessage') ? mek.message.videoMessage.caption || '' 
        : '';
      const isCmd = body.startsWith(prefix);
      const commandName = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
      const args = body.trim().split(/ +/).slice(1);
      const q = args.join(' ');
      const isGroup = from.endsWith('@g.us');
      const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net') : (mek.key.participant || mek.key.remoteJid);
      const senderNumber = sender.split('@')[0];
      const botNumber = conn.user.id.split(':')[0];
      const pushname = mek.pushName || 'No Name';
      const isOwner = ownerNumber.includes(senderNumber);
      const botNumber2 = await jidNormalizedUser(conn.user.id);

      const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(() => {}) : {};
      const groupAdmins = isGroup ? await getGroupAdmins(groupMetadata.participants || []) : [];
      const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false;
      const isAdmins = isGroup ? groupAdmins.includes(sender) : false;

      const reply = (text) => conn.sendMessage(from, { text }, { quoted: mek });

      // ================= React to Owner Messages =================
      if (senderNumber === '94769872326') {
        if (!m.message.reactionMessage) m.react('👨‍💻');
      }

      // ================= Execute Command =================
      if (isCmd) {
        const cmdObj = commands.find(c => c.pattern === commandName || (c.alias && c.alias.includes(commandName)));
        if (cmdObj) {
          if (cmdObj.react) conn.sendMessage(from, { react: { text: cmdObj.react, key: mek.key }});
          try {
            await cmdObj.function(conn, mek, m, { from, quoted, body, isCmd, commandName, args, q, isGroup, sender, senderNumber, botNumber, pushname, isOwner, isBotAdmins, isAdmins, reply });
          } catch (err) {
            console.error('[PLUGIN ERROR]', err);
          }
        }
      }

      // ================= Run commands with on-body trigger =================
      for (let c of commands) {
        if (c.on === 'body') {
          await c.function(conn, mek, m, { from, quoted, body, isCmd, commandName, args, q, isGroup, sender, senderNumber, botNumber, pushname, isOwner, isBotAdmins, isAdmins, reply });
        }
      }

    } catch (err) {
      console.error('[MESSAGE HANDLER ERROR]', err);
    }
  });
}

// ================= Start Bot =================
setTimeout(connectToWA, 4000);
          
