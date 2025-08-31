const {  
    default: makeWASocket,  
    useMultiFileAuthState,  
    DisconnectReason,  
    jidNormalizedUser,  
    getContentType,  
    fetchLatestBaileysVersion,  
    Browsers  
} = require('baileys-elite'); // Updated to Baileys-Elite

const { getBuffer, getGroupAdmins, sms } = require('./lib/functions');  
const fs = require('fs');  
const P = require('pino');  
const config = require('./config');  
const express = require('express');  
const axios = require('axios');  
const qrcode = require('qrcode-terminal');  
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
        fs.writeFileSync(__dirname + '/auth_info_baileys/creds.json', data);  
        console.log("Session downloaded ✅");  
    });  
}  

const app = express();  
const port = process.env.PORT || 8000;  

async function connectToWA() {  
    console.log("Connecting Senal MD BOT ⏳...");  
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

    conn.ev.on('connection.update', (update) => {  
        const { connection, lastDisconnect } = update;  
        if (connection === 'close') {  
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {  
                connectToWA();  
            }  
        } else if (connection === 'open') {  
            console.log('Bot connected to WhatsApp ✅');  
            // Load plugins
            const path = require('path');  
            fs.readdirSync("./plugins/").forEach((plugin) => {  
                if (path.extname(plugin).toLowerCase() === ".js") {  
                    require("./plugins/" + plugin);  
                }  
            });  
        }  
    });  

    conn.ev.on('creds.update', saveCreds);  

    conn.ev.on('messages.upsert', async (mek) => {  
        mek = mek.messages[0];  
        if (!mek.message) return;  
        mek.message = (getContentType(mek.message) === 'ephemeralMessage')  
            ? mek.message.ephemeralMessage.message  
            : mek.message;  

        if (mek.key?.remoteJid === 'status@broadcast' && config.AUTO_READ_STATUS === "true") {  
            await conn.readMessages([mek.key]);  
        }  

        const m = sms(conn, mek);  
        const type = getContentType(mek.message);  
        const from = mek.key.remoteJid;  
        const quoted = (type === 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo)  
            ? mek.message.extendedTextMessage.contextInfo.quotedMessage || []  
            : [];  

        const body = type === 'conversation' ? mek.message.conversation :  
                     type === 'extendedTextMessage' ? mek.message.extendedTextMessage.text :  
                     type === 'imageMessage' && mek.message.imageMessage.caption ? mek.message.imageMessage.caption :  
                     type === 'videoMessage' && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : '';  

        const isCmd = body?.startsWith(prefix);  
        const commandText = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';  
        const args = body.trim().split(/ +/).slice(isCmd ? 1 : 0);  
        const q = args.join(' ');  
        const isGroup = from.endsWith('@g.us');  
        const sender = mek.key.fromMe ? conn.user.id.split(':')[0] + '@s.whatsapp.net' : (mek.key.participant || mek.key.remoteJid);  
        const senderNumber = sender.split('@')[0];  
        const botNumber = conn.user.id.split(':')[0];  
        const pushname = mek.pushName || 'No Name';  
        const isOwner = ownerNumber.includes(senderNumber);  

        // ✅ Safe group metadata  
        let groupMetadata = {};  
        let groupName = '';  
        let participants = [];  
        if (isGroup) {  
            try {  
                groupMetadata = await conn.groupMetadata(from);  
                groupName = groupMetadata.subject || '';  
                participants = groupMetadata.participants || [];  
            } catch (e) {  
                groupMetadata = {};  
                groupName = '';  
                participants = [];  
            }  
        }  

        const groupAdmins = isGroup ? await getGroupAdmins(participants) : [];  
        const isBotAdmins = isGroup ? groupAdmins.includes(jidNormalizedUser(conn.user.id)) : false;  
        const isAdmins = isGroup ? groupAdmins.includes(sender) : false;  

        const reply = (text, extra = {}) => conn.sendMessage(from, { text, ...extra }, { quoted: mek });  

        // ========================= BUTTONS =========================
        const sendTextButton = async (text, footer, buttons) => {  
            const buttonMessage = { text, footer, buttons, headerType: 2 };  
            await conn.sendMessage(from, buttonMessage, { quoted: mek });  
        };  

        const sendMediaButton = async (type, url, caption, footer, buttons) => {  
            const msg = {};  
            msg[type] = { url };  
            msg.caption = caption;  
            msg.footer = footer;  
            msg.buttons = buttons;  
            msg.headerType = 1;  
            await conn.sendMessage(from, msg, { quoted: mek });  
        };  

        const sendInteractiveMessage = async (text, title, footer, interactiveButtons) => {  
            const message = { text, title, footer, interactiveButtons };  
            await conn.sendMessage(from, message, { quoted: mek });  
        };  

        // ========================= COMMAND HANDLER =========================
        const events = require('./command');  
        const cmd = isCmd   
            ? (events.commands.find(c => c.pattern === commandText) || events.commands.find(c => c.alias?.includes(commandText)))   
            : null;  

        if (cmd) {  
            try {  
                await cmd.function(conn, mek, m, { from, quoted, body, isCmd, command: commandText, args, q, isGroup, sender, senderNumber, botNumber, pushname, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply, sendTextButton, sendMediaButton, sendInteractiveMessage });  
            } catch (e) {  
                console.error("[PLUGIN ERROR] " + e);  
                reply("⚠️ An error occurred while executing the command.");  
            }  
        }  

        // ========================= EXAMPLE MENU =========================
        if (body === 'menu') {  
            const buttons = [  
                { index: 1, urlButton: { displayText: "🌍 Visit Website", url: "https://github.com/WhiskeySockets/Baileys" } },  
                { index: 2, callButton: { displayText: "📞 Call Owner", phoneNumber: "+94769872326" } },  
                { index: 3, quickReplyButton: { displayText: "Help 📖", id: `${prefix}help` } },  
                { index: 4, quickReplyButton: { displayText: "Owner 👑", id: `${prefix}owner` } }  
            ];  
            await sendTextButton("📌 Senal-MD Menu\nChoose an option 👇", "Senal-MD Bot", buttons);  
        }  
    });  
}  

app.get("/", (req, res) => res.send("Hey, Senal started✅"));  
app.listen(port, () => console.log(`Server running on port ${port}`));  

setTimeout(() => connectToWA(), 4000);
