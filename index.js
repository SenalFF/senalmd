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
const util = require('util');
const { sms } = require('./lib/msg');
const { File } = require('megajs');
const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

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
//============================================================

async function connectToWA() {
    console.log("Connecting Senal MD BOT ⏳️...");
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    var { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.macOS("Firefox"),
        auth: state,
        version
    });

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                console.log("⚠️ Disconnected, trying to reconnect...");
                connectToWA();
            } else {
                console.log("❌ Logged out. Delete creds and reconnect.");
            }
        }

        if (connection === 'open') {
            console.log('✅ Senal-MD connected');

            // Auto-send connect message with buttons
            conn.sendMessage(jidNormalizedUser(ownerNumber[0] + "@s.whatsapp.net"), {
                text: `🤖 *Senal-MD connected successfully* ✅

👨‍💻 Developer: Mr Senal
📡 Status: connected
🔁 AutoReconnect: true
💻 Platform: Railway

*PREFIX:* ${prefix}`,
                buttons: [
                    { buttonId: "channel", buttonText: { displayText: "📢 Channel" }, type: 1 },
                    { buttonId: "group", buttonText: { displayText: "👥 WhatsApp Group" }, type: 1 },
                    { buttonId: "owner", buttonText: { displayText: "📞 Contact Owner" }, type: 1 }
                ],
                headerType: 1
            });
        }
    });

    conn.ev.on('creds.update', saveCreds);

    // 📌 Message handler
    conn.ev.on('messages.upsert', async (mek) => {
        mek = mek.messages[0];
        if (!mek.message) return;

        mek.message = (getContentType(mek.message) === 'ephemeralMessage')
            ? mek.message.ephemeralMessage.message
            : mek.message;

        const from = mek.key.remoteJid;
        const type = getContentType(mek.message);
        const body = (type === 'conversation') ? mek.message.conversation :
                     (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text :
                     (type === 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption :
                     (type === 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : '';

        const isCmd = body.startsWith(prefix);
        const commandText = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';

        // ✅ Handle button clicks
        if (mek.message.buttonsResponseMessage) {
            const btnId = mek.message.buttonsResponseMessage.selectedButtonId;
            if (btnId === "channel") {
                await conn.sendMessage(from, { text: "📢 Join Channel: https://whatsapp.com/channel/0029VbBUZc1LNSaBaZDjkJ1y" });
            } else if (btnId === "group") {
                await conn.sendMessage(from, { text: "👥 Join Group: https://chat.whatsapp.com/Ef9569Wpror1OAkWCFcE9q?mode=ems_share_t" });
            } else if (btnId === "owner") {
                await conn.sendMessage(from, { text: "📞 Contact Owner: https://wa.link/bgbwbp" });
            }
            return;
        }

        // ✅ Command detection
        if (isCmd) {
            if (commandText === "alive") {
                await conn.sendMessage(from, { text: "Im Alive Now ♿" }, { quoted: mek });
            }
            if (commandText === "menu") {
                await conn.sendMessage(from, {
                    text: "📌 *MR SENAL CONTROL CMDz*\n\n• .alive\n• .menu\n• .song\n• .video\n• .apk\n• .sticker\n• Bot Check\n\nGenerated by Mr Senal",
                    buttons: [
                        { buttonId: ".alive", buttonText: { displayText: "✅ Alive" }, type: 1 },
                        { buttonId: ".song", buttonText: { displayText: "🎶 Song" }, type: 1 },
                        { buttonId: ".video", buttonText: { displayText: "🎥 Video" }, type: 1 }
                    ],
                    headerType: 1
                }, { quoted: mek });
            }
        }
    });
}

app.get("/", (req, res) => {
    res.send("Hey, Senal started✅");
});

app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));

setTimeout(() => {
    connectToWA();
}, 4000);
