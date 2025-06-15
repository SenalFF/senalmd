const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const P = require('pino');
const fs = require('fs');
const express = require("express");
const config = require('./config');
const { sms } = require('./lib/msg');
const { sendMainMenu, handleButtonResponse } = require('./lib/bmsg');
const events = require('./command');

const prefix = '.';
const ownerNumber = ['94769872326'];
const app = express();
const port = process.env.PORT || 8000;

async function connectToWA() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys/');
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: Browsers.macOS("Firefox"),
    logger: P({ level: 'silent' }),
    version
  });

  conn.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
      connectToWA();
    }
  });

  conn.ev.on('creds.update', saveCreds);

  conn.ev.on('messages.upsert', async ({ messages }) => {
    const mek = messages[0];
    if (!mek.message) return;

    const m = sms(conn, mek);
    const from = mek.key.remoteJid;
    const type = getContentType(mek.message);
    const body =
      type === 'conversation' ? mek.message.conversation :
      type === 'extendedTextMessage' ? mek.message.extendedTextMessage.text : '';

    const isCmd = body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
    const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage || mek.quoted;
    const args = body.split(/\s+/).slice(1);
    const reply = (text) => conn.sendMessage(from, { text }, { quoted: mek });

    // 🎯 Main button menu
    if (isCmd && command === 'bmenu') {
      return sendMainMenu(conn, from, mek);
    }

    // 🔘 Handle button response
    if (mek.message?.buttonsResponseMessage) {
      return handleButtonResponse(conn, mek.message.buttonsResponseMessage.selectedButtonId, from, mek);
    }

    // ⚙ Plugin command execution
    const cmd = events.commands.find(c => c.pattern === command || c.alias?.includes(command));
    if (cmd) {
      try {
        await cmd.function(conn, mek, m, { from, body, args, command, quoted, reply });
      } catch (err) {
        console.error('[PLUGIN ERROR]', err);
        reply('❌ An error occurred while executing the command.');
      }
    }
  });
}

app.get("/", (_, res) => res.send("Senal-MD is running ✅"));
app.listen(port, () => console.log(`✅ Server listening on http://localhost:${port}`));
setTimeout(connectToWA, 3000);
