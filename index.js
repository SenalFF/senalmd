const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, jidNormalizedUser, getContentType, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions');
const fs = require('fs');
const P = require('pino');
const config = require('./config');
const qrcode = require('qrcode-terminal');
const util = require('util');
const { sms, downloadMediaMessage } = require('./lib/msg');
const { sendMainMenu, handleButtonResponse } = require('./lib/bmsg');
const axios = require('axios');
const { File } = require('megajs');
const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

const prefix = '.';
const ownerNumber = ['94769872326@s.whatsapp.net']; // Added @s.whatsapp.net

//===================SESSION-AUTH============================
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (!config.SESSION_ID) return console.log('Please add your session to SESSION_ID env!!');
    const sessdata = config.SESSION_ID;
    const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
    filer.download((err, data) => {
        if (err) throw err;
        fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
            console.log("Session downloaded ✓");
        });
    });
}

async function connectToWA() {
    console.log("Connecting Senal MD BOT ⚡...");
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    var { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS("Firefox"),
        syncFullHistory: true,
        auth: state,
        version
    });

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if ((lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
                connectToWA();
            } else {
                console.log('Connection closed. You are logged out.');
            }
        } else if (connection === 'open') {
            console.log('🤖 Installing plugins...');
            const path = require('path');
            fs.readdirSync("./plugins/").forEach((plugin) => {
                if (path.extname(plugin).toLowerCase() === ".js") {
                    require("./plugins/" + plugin);
                }
            });
            console.log('Plugins installed successfully ✓');
            console.log('Bot connected to WhatsApp ✓');

            let up = `Senal-MD connected successfully ✓\n\nPREFIX: ${prefix}`;
            conn.sendMessage(ownerNumber[0], { image: { url: `https://files.catbox.moe/gm88nn.png` }, caption: up });
        }
    });

    conn.ev.on('creds.update', saveCreds);

    const { commands } = require('./command'); // Import commands here

    conn.ev.on('messages.upsert', async (mek) => {
        mek = mek.messages[0];
        if (!mek.message) return;

        // Support ephemeral message type
        mek.message = mek.message.ephemeralMessage ? mek.message.ephemeralMessage.message : mek.message;

        const type = getContentType(mek.message);
        const from = mek.key.remoteJid;
        const body = (type === 'conversation') ? mek.message.conversation :
            (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text :
            (type === 'imageMessage' && mek.message.imageMessage.caption) ? mek.message.imageMessage.caption :
            (type === 'videoMessage' && mek.message.videoMessage.caption) ? mek.message.videoMessage.caption : '';

        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const q = args.join(' ');

        const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];
        const isMe = botNumber.includes(senderNumber);
        const isOwner = ownerNumber.includes(sender) || isMe;

        const reply = (text) => {
            conn.sendMessage(from, { text: text }, { quoted: mek });
        };

        // 1. Handle prefix commands like ".menu"
        if (isCmd) {
            const cmd = commands.find(c => c.pattern === command || (c.alias && c.alias.includes(command)));
            if (cmd && (cmd.on === 'command' || !cmd.on)) {
                if (cmd.react) await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                try {
                    await cmd.function(conn, mek, null, { from, body, isCmd, command, args, q, sender, senderNumber, isOwner, reply });
                } catch (e) {
                    console.error('[COMMAND ERROR]', e);
                }
            }
        }

        // 2. Handle body text commands (e.g., user just sends "menu")
        else {
            const btnCmd = commands.find(c => c.on === 'body' && c.pattern.toLowerCase() === body.toLowerCase());
            if (btnCmd) {
                try {
                    await btnCmd.function(conn, mek, null, { from, body, isCmd, command, args, q, sender, senderNumber, isOwner, reply });
                } catch (e) {
                    console.error('[BODY TEXT ERROR]', e);
                }
            }
        }

        // 3. Handle number reply commands (e.g., user replies "2")
        const numberCmd = commands.find(c => c.on === 'number' && c.pattern === body);
        if (numberCmd) {
            try {
                await numberCmd.function(conn, mek, null, { from, body, isCmd, command, args, q, sender, senderNumber, isOwner, reply });
            } catch (e) {
                console.error('[NUMBER REPLY ERROR]', e);
            }
        }
    });

    app.get("/", (req, res) => {
        res.send("Hey, Senal started✓");
    });

    app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));
}

setTimeout(() => {
    connectToWA();
}, 4000);
