const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
    fetchLatestBaileysVersion,
    Browsers,
    proto,
    generateWAMessageFromContent,
    prepareWAMessageMedia
} = require('@whiskeysockets/baileys');
const { getBuffer, getGroupAdmins, fetchJson } = require('./lib/functions');
const fs = require('fs');
const P = require('pino');
const config = require('./config');
const { sms, downloadMediaMessage } = require('./lib'); 
const axios = require('axios');
const { File } = require('megajs');
const prefix = '.';

const ownerNumber = ['94769872326'];

//=================== SESSION-AUTH ============================
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

//=============================================================

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

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                connectToWA();
            }
        } else if (connection === 'open') {
            console.log('🧬 Installing Plugins...');
            const path = require('path');
            fs.readdirSync("./plugins/").forEach((plugin) => {
                if (path.extname(plugin).toLowerCase() == ".js") {
                    require("./plugins/" + plugin);
                }
            });
            console.log('Plugins installed successfully ✅');
            console.log('Bot connected to WhatsApp ✅');

            let up = `Senal-MD connected successfully ✅\n\nPREFIX: ${prefix}`;
            conn.sendMessage(ownerNumber + "@s.whatsapp.net", { text: up });
        }
    });
    conn.ev.on('creds.update', saveCreds);

    //================ Messages ======================
    conn.ev.on('messages.upsert', async (mek) => {
        mek = mek.messages[0];
        if (!mek.message) return;
        mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;

        const m = sms(conn, mek);
        const type = getContentType(mek.message);
        const from = mek.key.remoteJid;

        const body = (type === 'conversation') ? mek.message.conversation :
            (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text :
                (type == 'imageMessage' && mek.message.imageMessage.caption) ? mek.message.imageMessage.caption :
                    (type == 'videoMessage' && mek.message.videoMessage.caption) ? mek.message.videoMessage.caption : '';

        const isCmd = body.startsWith(prefix);
        const commandText = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(isCmd ? 1 : 0);
        const q = args.join(' ');
        const isGroup = from.endsWith('@g.us');
        const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const botNumber2 = await jidNormalizedUser(conn.user.id);

        // Reply helper
        const reply = (text, extra = {}) => conn.sendMessage(from, { text, ...extra }, { quoted: mek });

        //================ Ban System ==================
        const bannedUsers = JSON.parse(fs.readFileSync('./lib/ban.json', 'utf-8'));
        if (bannedUsers.includes(senderNumber)) return; // ignore banned users

        //================ Example Commands =============
        if (isCmd) {
            switch (commandText) {
                case 'ban':
                    if (!ownerNumber.includes(senderNumber)) return reply("❌ Only owner can ban users!");
                    if (!q) return reply("⚠️ Provide a number to ban.");
                    bannedUsers.push(q);
                    fs.writeFileSync('./lib/ban.json', JSON.stringify(bannedUsers, null, 2));
                    reply(`✅ User ${q} banned.`);
                    break;

                case 'unban':
                    if (!ownerNumber.includes(senderNumber)) return reply("❌ Only owner can unban users!");
                    if (!q) return reply("⚠️ Provide a number to unban.");
                    const index = bannedUsers.indexOf(q);
                    if (index !== -1) {
                        bannedUsers.splice(index, 1);
                        fs.writeFileSync('./lib/ban.json', JSON.stringify(bannedUsers, null, 2));
                        reply(`✅ User ${q} unbanned.`);
                    } else reply("⚠️ User not found in ban list.");
                    break;

                case 'menu':
                    let buttons = [
                        { buttonId: `${prefix}owner`, buttonText: { displayText: "👑 Owner" }, type: 1 },
                        { buttonId: `${prefix}ping`, buttonText: { displayText: "📡 Ping" }, type: 1 }
                    ];
                    conn.sendButtonText(from, buttons, "✨ Senal-MD Menu", "Senal-MD Bot", mek);
                    break;

                case 'ping':
                    reply("🏓 Pong!");
                    break;

                case 'owner':
                    reply("👑 Owner: " + ownerNumber[0]);
                    break;
            }
        }
    });

    //=============== Utility Functions ===============
    conn.sendButtonText = (jid, buttons = [], text, footer, quoted = '', options = {}) => {
        let buttonMessage = {
            text,
            footer,
            buttons,
            headerType: 2,
            ...options
        };
        conn.sendMessage(jid, buttonMessage, { quoted, ...options });
    };

    conn.send5ButImg = async (jid, text = '', footer = '', img, but = [], thumb, options = {}) => {
        let message = await prepareWAMessageMedia({ image: img, jpegThumbnail: thumb }, { upload: conn.waUploadToServer });
        var template = generateWAMessageFromContent(jid, proto.Message.fromObject({
            templateMessage: {
                hydratedTemplate: {
                    imageMessage: message.imageMessage,
                    hydratedContentText: text,
                    hydratedFooterText: footer,
                    hydratedButtons: but
                }
            }
        }), options);
        conn.relayMessage(jid, template.message, { messageId: template.key.id });
    };

    conn.sendTextWithMentions = async (jid, text, quoted, options = {}) =>
        conn.sendMessage(
            jid,
            { text: text, contextInfo: { mentionedJid: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net') }, ...options },
            { quoted }
        );
}

//================= Express KeepAlive =================
app.get("/", (req, res) => {
    res.send("Hey, Senal started✅");
});
app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));
setTimeout(() => {
    connectToWA();
}, 4000);
