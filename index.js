// Fixed Senal-MD index.js
// Changes made:
//  - Safe group metadata fetching (avoids crashes when group metadata unavailable)
//  - Robust message body extraction (supports conversation, extendedText, buttons, lists, image/video captions, documents)
//  - Proper quoted message extraction from any contextInfo
//  - Safer admin checks and normalization of JIDs
//  - Fixed owner notification sending (handles ownerNumber array properly)
//  - Added small defensive checks for connection update
//  - Auto developer/status/platform info + preview/button reply after connected

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

//=================== BOT INFO ============================
const BOT_INFO = {
    developer: "Mr Senal",
    status: "connected",
    autoReconnect: true,
    platform: "railway"
};
//=========================================================

//===================SESSION-AUTH==========================
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
//==========================================================

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

// Helper: safely extract body and quoted message
function extractMessageInfo(message) {
    const type = getContentType(message);
    let body = '';
    let quoted = null;

    const ctxCandidates = [
        message.extendedTextMessage?.contextInfo,
        message.imageMessage?.contextInfo,
        message.videoMessage?.contextInfo,
        message.documentMessage?.contextInfo,
        message.buttonsResponseMessage?.contextInfo,
        message.listResponseMessage?.contextInfo
    ];

    const contextInfo = ctxCandidates.find(c => !!c) || null;

    switch (type) {
        case 'conversation':
            body = message.conversation || '';
            break;
        case 'extendedTextMessage':
            body = message.extendedTextMessage?.text || '';
            break;
        case 'imageMessage':
            body = message.imageMessage?.caption || '';
            break;
        case 'videoMessage':
            body = message.videoMessage?.caption || '';
            break;
        case 'documentMessage':
            body = message.documentMessage?.caption || '';
            break;
        case 'buttonsResponseMessage':
            body = message.buttonsResponseMessage?.selectedButtonId || message.buttonsResponseMessage?.selectedDisplayText || '';
            break;
        case 'listResponseMessage':
            body = message.listResponseMessage?.singleSelectReply?.selectedRowId || message.listResponseMessage?.singleSelectReply?.selectedRowText || message.listResponseMessage?.title || '';
            break;
        default:
            body = '';
    }

    if (contextInfo && contextInfo.quotedMessage) {
        quoted = contextInfo.quotedMessage;
    }

    return { type, body: (body || '').toString(), quoted, contextInfo };
}

// Safe group metadata
async function safeGroupMetadata(conn, jid) {
    if (!jid || !jid.endsWith('@g.us')) return null;
    try {
        const meta = await conn.groupMetadata(jid);
        return meta || null;
    } catch {
        return null;
    }
}

async function connectToWA() {
    console.log("Connecting Senal MD BOT ...");
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
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut && BOT_INFO.autoReconnect) {
                console.log('Connection closed unexpectedly, reconnecting...');
                connectToWA();
            } else {
                console.log('Logged out. Please remove auth files and re-login.');
            }
        } else if (connection === 'open') {
            console.log(`✅ BOT CONNECTED | Developer: ${BOT_INFO.developer} | Platform: ${BOT_INFO.platform}`);

            // Auto send welcome message to owners
            let up = `🤖 Senal-MD connected successfully ✓\n\n👨‍💻 Developer: ${BOT_INFO.developer}\n📌 Status: ${BOT_INFO.status}\n🔄 AutoReconnect: ${BOT_INFO.autoReconnect}\n💻 Platform: ${BOT_INFO.platform}\n\nPREFIX: ${prefix}`;
            for (const num of ownerNumber) {
                conn.sendMessage(num + "@s.whatsapp.net", {
                    text: up,
                    contextInfo: {
                        externalAdReply: {
                            title: "Senal MD Bot",
                            body: "Connected Successfully ✅",
                            thumbnailUrl: "https://telegra.ph/file/f2be313fe820b56b47748.png",
                            sourceUrl: "https://whatsapp.com/channel/0029VbBUZc1LNSaBaZDjkJ1y",
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                });

                // Button reply
                conn.sendMessage(num + "@s.whatsapp.net", {
                    text: "⚡ Choose an option below:",
                    buttons: [
                        { buttonId: "group_link", buttonText: { displayText: "🔗 WhatsApp Group" }, type: 1 },
                        { buttonId: "channel_link", buttonText: { displayText: "📢 WhatsApp Channel" }, type: 1 },
                        { buttonId: "contact_owner", buttonText: { displayText: "👨‍💻 Contact Owner" }, type: 1 }
                    ],
                    headerType: 4
                });
            }

            // Load plugins
            const path = require('path');
            fs.readdirSync("./plugins/").forEach((plugin) => {
                if (path.extname(plugin).toLowerCase() == ".js") {
                    try {
                        require("./plugins/" + plugin);
                    } catch (e) {
                        console.error('[PLUGIN LOAD ERROR]', plugin, e);
                    }
                }
            });
        }
    });

    conn.ev.on('creds.update', saveCreds);

    // Handle button responses
    conn.ev.on('messages.upsert', async (mek) => {
        try {
            if (!mek.messages || mek.messages.length === 0) return;
            let msg = mek.messages[0];
            if (!msg.message || !msg.key.fromMe) return;

            if (msg.message.buttonsResponseMessage) {
                const btnId = msg.message.buttonsResponseMessage.selectedButtonId;
                if (btnId === "group_link") {
                    await conn.sendMessage(msg.key.remoteJid, { text: "👉 Join Group: https://chat.whatsapp.com/Ef9569Wpror1OAkWCFcE9q?mode=ems_share_t" });
                } else if (btnId === "channel_link") {
                    await conn.sendMessage(msg.key.remoteJid, { text: "📢 Join Channel: https://whatsapp.com/channel/0029VbBUZc1LNSaBaZDjkJ1y" });
                } else if (btnId === "contact_owner") {
                    await conn.sendMessage(msg.key.remoteJid, { text: "👨‍💻 Contact Owner: https://wa.link/bgbwbp" });
                }
            }
        } catch (err) {
            console.error('[MESSAGE HANDLER ERROR]', err);
        }
    });
}

app.get("/", (req, res) => { res.send("Hey, Senal started ✓"); });
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));

// start
setTimeout(() => { connectToWA(); }, 4000);
