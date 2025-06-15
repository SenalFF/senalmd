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
const path = require('path');
const express = require('express');

const app = express();
const port = process.env.PORT || 8000;

const prefix = '.';
const ownerNumber = ['94769872326'];
const sessionFolder = __dirname + '/auth_info_baileys/';
const sessionFile = sessionFolder + 'creds.json';

// Download session if not exists
async function ensureSessionFile() {
    if (fs.existsSync(sessionFile)) return;
    if (!config.SESSION_ID) return console.log('❌ Please set your SESSION_ID in config.js or env!');
    console.log('📦 Downloading session from MEGA...');
    const file = File.fromURL(`https://mega.nz/file/${config.SESSION_ID}`);
    file.downloadBuffer().then((buffer) => {
        fs.mkdirSync(sessionFolder, { recursive: true });
        fs.writeFileSync(sessionFile, buffer);
        console.log("✅ Session downloaded and saved.");
    }).catch(err => {
        console.error("❌ Error downloading session file from MEGA:", err.message);
    });
}

async function connectToWA() {
    console.log("🧬 Connecting Senal MD BOT ⏳️...");
    await ensureSessionFile();
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS("Firefox"),
        syncFullHistory: true,
        auth: state,
        version
    });

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`❌ Connection closed. Reconnect: ${shouldReconnect}`);
            if (shouldReconnect) connectToWA();
        } else if (connection === 'open') {
            console.log('✅ Bot connected to WhatsApp');
            console.log('🔌 Installing plugins...');
            fs.readdirSync("./plugins/").forEach((plugin) => {
                if (path.extname(plugin).toLowerCase() == ".js") {
                    require("./plugins/" + plugin);
                }
            });
            console.log('✅ Plugins installed successfully.');

            let msg = `✨ Senal-MD connected successfully!\n\n📍 PREFIX: ${prefix}`;
            conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
                image: { url: `https://files.catbox.moe/gm88nn.png` },
                caption: msg
            });
        }
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async (mekData) => {
        const mek = mekData.messages[0];
        if (!mek?.message) return;

        mek.message = getContentType(mek.message) === 'ephemeralMessage'
            ? mek.message.ephemeralMessage.message
            : mek.message;

        const m = sms(conn, mek);
        const type = getContentType(mek.message);
        const from = mek.key.remoteJid;
        const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage || {};
        const body =
            mek.message?.conversation ||
            mek.message?.extendedTextMessage?.text ||
            mek.message?.imageMessage?.caption ||
            mek.message?.videoMessage?.caption || '';

        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/\s+/).slice(1);
        const q = args.join(' ');
        const isGroup = from.endsWith('@g.us');
        const sender = mek.key.fromMe ? conn.user.id.split(':')[0] + '@s.whatsapp.net' : (mek.key.participant || from);
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];
        const pushname = mek.pushName || 'No Name';
        const isMe = botNumber.includes(senderNumber);
        const isOwner = ownerNumber.includes(senderNumber) || isMe;
        const botNumber2 = await jidNormalizedUser(conn.user.id);
        const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(() => {}) : '';
        const groupName = groupMetadata?.subject || '';
        const participants = groupMetadata?.participants || [];
        const groupAdmins = isGroup ? await getGroupAdmins(participants) : [];
        const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false;
        const isAdmins = isGroup ? groupAdmins.includes(sender) : false;
        const reply = (text) => conn.sendMessage(from, { text }, { quoted: mek });

        //=================== Commands =========================
        const events = require('./command');
        const cmdName = isCmd ? command : false;

        if (isCmd) {
            const cmd = events.commands.find((cmd) => cmd.pattern === cmdName) ||
                        events.commands.find((cmd) => cmd.alias?.includes(cmdName));

            if (cmd) {
                if (cmd.react) {
                    conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                }

                try {
                    await cmd.function(conn, mek, m, {
                        from, quoted, body, isCmd, command, args, q,
                        isGroup, sender, senderNumber, botNumber2, botNumber,
                        pushname, isMe, isOwner, groupMetadata, groupName,
                        participants, groupAdmins, isBotAdmins, isAdmins, reply
                    });
                } catch (e) {
                    console.error("[PLUGIN ERROR]", e);
                }
            }
        }

        for (const command of events.commands) {
            if (command.on === "body" && body) {
                await command.function(conn, mek, m, {
                    from, quoted, body, isCmd, command, args, q,
                    isGroup, sender, senderNumber, botNumber2, botNumber,
                    pushname, isMe, isOwner, groupMetadata, groupName,
                    participants, groupAdmins, isBotAdmins, isAdmins, reply
                });
            }
        }
    });
}

// Express Route
app.get("/", (req, res) => {
    res.send("✅ Senal MD bot is running!");
});

// Start server
app.listen(port, () => console.log(`🌐 Server running: http://localhost:${port}`));

// Connect after slight delay
setTimeout(() => {
    connectToWA();
}, 3000);
