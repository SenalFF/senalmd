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
const prefix = '.';

const ownerNumber = ['94769872326'];

//===================SESSION-AUTH============================
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (!config.SESSION_ID) return console.log('Please add your session to SESSION_ID env!!');
    const sessdata = config.SESSION_ID;
    const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
    filer.download((err, data) => {
        if (err) throw err;
        fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
            console.log("Session downloaded ✅");
        });
    });
}

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

//=============================================

async function connectToWA() {
    console.log("Connecting Senal MD BOT ⏳️...");
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

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                connectToWA();
            }
        } else if (connection === 'open') {
            console.log('🧬 Installing');
            const path = require('path');
            fs.readdirSync("./plugins/").forEach((plugin) => {
                if (path.extname(plugin).toLowerCase() == ".js") {
                    require("./plugins/" + plugin);
                }
            });
            console.log('Plugins installed successfully ✅');
            console.log('Bot connected to WhatsApp ✅');

            let up = `🤖 *Senal-MD connected successfully* ✅

👨‍💻 Developer: Mr Senal
📡 Status: connected
🔁 AutoReconnect: true
💻 Platform: Railway

*PREFIX:* ${prefix}`;

            await conn.sendMessage(jidNormalizedUser(ownerNumber[0] + "@s.whatsapp.net"), {
                text: up,
                footer: "Choose an option below 👇",
                templateButtons: [
                    { index: 1, urlButton: { displayText: "📢 Channel", url: "https://whatsapp.com/channel/0029VbBUZc1LNSaBaZDjkJ1y" } },
                    { index: 2, urlButton: { displayText: "👥 WhatsApp Group", url: "https://chat.whatsapp.com/Ef9569Wpror1OAkWCFcE9q?mode=ems_share_t" } },
                    { index: 3, urlButton: { displayText: "📞 Contact Owner", url: "https://wa.link/bgbwbp" } }
                ]
            });
        }
    });
    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async (mek) => {
        mek = mek.messages[0];
        if (!mek.message) return;
        mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;

        if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_READ_STATUS === "true") {
            await conn.readMessages([mek.key]);
        }

        const m = sms(conn, mek);
        const type = getContentType(mek.message);
        const from = mek.key.remoteJid;
        const quoted = (type == 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo) 
            ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] 
            : [];

        const body = (type === 'conversation') ? mek.message.conversation : 
                     (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : 
                     (type === 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption : 
                     (type === 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : '';

        const isCmd = body.startsWith(prefix);
        const commandText = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(isCmd ? 1 : 0);
        const q = args.join(' ');
        const isGroup = from.endsWith('@g.us');
        const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];
        const pushname = mek.pushName || 'No Name';
        const isMe = botNumber.includes(senderNumber);
        const isOwner = ownerNumber.includes(senderNumber) || isMe;
        const botNumber2 = await jidNormalizedUser(conn.user.id);
        const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(() => {}) : '';
        const groupName = isGroup ? groupMetadata.subject : '';
        const participants = isGroup ? await groupMetadata.participants : '';
        const groupAdmins = isGroup ? await getGroupAdmins(participants) : '';
        const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false;
        const isAdmins = isGroup ? groupAdmins.includes(sender) : false;

        // Reply helper with link preview auto
        const reply = (text, extra = {}) => {
            const opts = { text, ...extra };
            if (/(https?:\/\/[^\s]+)/.test(text)) {
                opts.previewType = "link";
            }
            return conn.sendMessage(from, opts, { quoted: mek });
        };

        // Load commands module
        const events = require('./command');
        const cmd = isCmd 
            ? (events.commands.find(c => c.pattern === commandText) || events.commands.find(c => c.alias && c.alias.includes(commandText))) 
            : null;
        const numberCmd = events.commands.find(c => c.on === 'number' && c.pattern === body);

        if (cmd) {
            if (cmd.react) {
                await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
            }
            try {
                await cmd.function(conn, mek, m, { from, quoted, body, isCmd, command: commandText, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
            } catch (e) {
                console.error("[PLUGIN ERROR] " + e);
                reply("⚠️ An error occurred while executing the command.");
            }
            return;
        }

        if (numberCmd) {
            try {
                await numberCmd.function(conn, mek, m, { from, quoted, body, isCmd: false, command: numberCmd.pattern, args: [], q: '', isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
            } catch (e) {
                console.error("[NUMBER CMD ERROR] " + e);
                reply("⚠️ An error occurred while executing the number command.");
            }
            return;
        }

        events.commands.map(async (command) => {
            if (body && command.on === "body") {
                try {
                    await command.function(conn, mek, m, { from, quoted, body, isCmd, command: command.pattern, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                } catch (e) {
                    console.error("[BODY CMD ERROR] " + e);
                }
            }
        });
    });
}

app.get("/", (req, res) => {
    res.send("Hey, Senal started✅");
});
app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));
setTimeout(() => {
    connectToWA();
}, 4000);
