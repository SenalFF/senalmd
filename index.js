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
const app = express();
const prefix = '.';
const port = process.env.PORT || 8000;

const ownerNumber = ['94767707223'];

//=================== SESSION AUTH ============================
const sessionPath = __dirname + '/auth_info_baileys/creds.json';
if (!fs.existsSync(sessionPath)) {
    if (!config.SESSION_ID) {
        console.log('❌ Please add your session to SESSION_ID env!!');
        process.exit(1);
    }
    console.log('⬇️ Downloading session from MEGA...');
    const sessdata = config.SESSION_ID;
    const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
    filer.download((err, data) => {
        if (err) throw err;
        fs.mkdirSync(__dirname + '/auth_info_baileys', { recursive: true });
        fs.writeFile(sessionPath, data, () => {
            console.log('✅ Session downloaded successfully!');
        });
    });
}

//=================== CONNECT FUNCTION ============================
async function connectToWA() {
    console.log("⏳ Connecting Senal MD BOT...");

    try {
        const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            logger: P({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.macOS("Firefox"),
            syncFullHistory: true,
            auth: state,
            version
        });

        // ===== Connection Handling =====
        conn.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update || {};
            const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode;

            if (connection === 'close') {
                if (reason === DisconnectReason.loggedOut) {
                    console.log('❌ Session logged out or invalid. Delete /auth_info_baileys and rescan QR.');
                } else {
                    console.log('🔁 Connection closed. Reconnecting in 5 seconds...');
                    setTimeout(() => connectToWA(), 5000);
                }
            } else if (connection === 'open') {
                console.log('✅ Senal MD BOT Connected!');
                console.log('🧬 Installing Plugins...');
                const path = require('path');
                fs.readdirSync("./plugins/").forEach((plugin) => {
                    if (path.extname(plugin).toLowerCase() == ".js") {
                        require("./plugins/" + plugin);
                    }
                });
                console.log('✅ Plugins installed successfully');
                console.log('🚀 Bot is active and ready!');

                // Notify owner
                conn.sendMessage(ownerNumber + "@s.whatsapp.net", {
                    image: { url: `https://files.catbox.moe/gm88nn.png` },
                    caption: `Senal-MD connected successfully ✅\n\nPREFIX: ${prefix}`
                });
            } else if (connection === 'connecting') {
                console.log('🔌 Connecting to WhatsApp servers...');
            }
        });

        conn.ev.on('creds.update', saveCreds);

        // ===== Message Handling =====
        conn.ev.on('messages.upsert', async (mek) => {
            mek = mek.messages[0];
            if (!mek.message) return;
            mek.message = (getContentType(mek.message) === 'ephemeralMessage')
                ? mek.message.ephemeralMessage.message
                : mek.message;

            if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_READ_STATUS === "true") {
                await conn.readMessages([mek.key]);
            }

            const m = sms(conn, mek);
            const type = getContentType(mek.message);
            const body =
                type === 'conversation' ? mek.message.conversation :
                type === 'extendedTextMessage' ? mek.message.extendedTextMessage.text :
                type === 'imageMessage' && mek.message.imageMessage.caption ? mek.message.imageMessage.caption :
                type === 'videoMessage' && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : '';

            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(' ');
            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = mek.key.fromMe
                ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id)
                : (mek.key.participant || mek.key.remoteJid);
            const senderNumber = sender.split('@')[0];
            const botNumber = conn.user.id.split(':')[0];
            const pushname = mek.pushName || 'No Name';
            const isMe = botNumber.includes(senderNumber);
            const isOwner = ownerNumber.includes(senderNumber) || isMe;
            const botNumber2 = await jidNormalizedUser(conn.user.id);
            const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(() => {}) : '';
            const groupName = isGroup ? groupMetadata.subject : '';
            const participants = isGroup ? groupMetadata.participants : '';
            const groupAdmins = isGroup ? await getGroupAdmins(participants) : '';
            const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false;
            const isAdmins = isGroup ? groupAdmins.includes(sender) : false;
            const reply = (teks) => conn.sendMessage(from, { text: teks }, { quoted: mek });

            // ===== Commands System =====
            const events = require('./command');
            const cmdName = isCmd ? body.slice(1).trim().split(" ")[0].toLowerCase() : false;

            if (isCmd) {
                const cmd = events.commands.find((cmd) => cmd.pattern === cmdName) ||
                            events.commands.find((cmd) => cmd.alias && cmd.alias.includes(cmdName));
                if (cmd) {
                    if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                    try {
                        cmd.function(conn, mek, m, {
                            from, quoted: mek, body, isCmd, command, args, q,
                            isGroup, sender, senderNumber, botNumber2, botNumber,
                            pushname, isMe, isOwner, groupMetadata, groupName,
                            participants, groupAdmins, isBotAdmins, isAdmins, reply
                        });
                    } catch (e) {
                        console.error("[PLUGIN ERROR] " + e);
                    }
                }
            }

            // ===== Passive Commands (on: 'body') =====
            events.commands.map(async (command) => {
                if (body && command.on === "body") {
                    command.function(conn, mek, m, {
                        from, quoted: mek, body, isCmd, command, args, q,
                        isGroup, sender, senderNumber, botNumber2, botNumber,
                        pushname, isMe, isOwner, groupMetadata, groupName,
                        participants, groupAdmins, isBotAdmins, isAdmins, reply
                    });
                }
            });
        });

    } catch (err) {
        console.error("❌ Error connecting to WhatsApp:", err);
        console.log("Retrying in 5 seconds...");
        setTimeout(() => connectToWA(), 5000);
    }
}

//=================== EXPRESS SERVER ============================
app.get("/", (req, res) => {
    res.send("Hey, Senal started✅");
});
app.listen(port, () => console.log(`🌐 Server listening on http://localhost:${port}`));

//=================== START BOT ============================
setTimeout(() => {
    connectToWA();
}, 4000);
