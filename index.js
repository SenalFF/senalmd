// ================= Load Environment Variables =================
const dotenv = require("dotenv");
dotenv.config();

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

// Create auth directory if it doesn't exist
if (!fs.existsSync(__dirname + '/auth_info_baileys')) {
    fs.mkdirSync(__dirname + '/auth_info_baileys', { recursive: true });
}

//===================SESSION-AUTH============================
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (!config.SESSION_ID) {
        console.log('Please add your session to SESSION_ID env!!');
        process.exit(1);
    }
    const sessdata = config.SESSION_ID;
    try {
        const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
        filer.download((err, data) => {
            if (err) {
                console.error('Failed to download session:', err);
                process.exit(1);
            }
            fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, (writeErr) => {
                if (writeErr) {
                    console.error('Failed to write session file:', writeErr);
                    process.exit(1);
                }
                console.log("Session downloaded ✅");
            });
        });
    } catch (error) {
        console.error('Error setting up session download:', error);
        process.exit(1);
    }
}

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

//=============================================

async function connectToWA() {
    try {
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
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log('Connection closed. Status code:', statusCode);
                console.log('Reason:', lastDisconnect?.error);
                
                if (shouldReconnect) {
                    console.log('Reconnecting in 5 seconds...');
                    setTimeout(() => {
                        connectToWA();
                    }, 5000);
                } else {
                    console.log('Logged out. Please scan QR code again or update SESSION_ID.');
                }
            } else if (connection === 'open') {
                console.log('🧬 Installing plugins...');
                const path = require('path');
                
                try {
                    if (fs.existsSync("./plugins/")) {
                        fs.readdirSync("./plugins/").forEach((plugin) => {
                            if (path.extname(plugin).toLowerCase() == ".js") {
                                require("./plugins/" + plugin);
                            }
                        });
                        console.log('Plugins installed successfully ✅');
                    } else {
                        console.log('No plugins directory found. Skipping plugin installation.');
                    }
                    
                    console.log('Bot connected to WhatsApp ✅');

                    let up = `Senal-MD connected successfully ✅\n\nPREFIX: ${prefix}`;

                    conn.sendMessage(ownerNumber + "@s.whatsapp.net", { 
                        image: { url: `https://files.catbox.moe/gm88nn.png` }, 
                        caption: up 
                    }).catch(err => console.log('Failed to send startup message:', err));
                } catch (err) {
                    console.error('Error during initialization:', err);
                }
            } else if (connection === 'connecting') {
                console.log('Connecting to WhatsApp...');
            }
        });

        conn.ev.on('creds.update', saveCreds);

        conn.ev.on('messages.upsert', async (mek) => {
            try {
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

                // Reply helper
                const reply = (text, extra = {}) => {
                    return conn.sendMessage(from, { text, ...extra }, { quoted: mek });
                };

                // Load commands module
                const events = require('./command');
                
                // Find command by command text
                const cmd = isCmd 
                    ? (events.commands.find(c => c.pattern === commandText) || events.commands.find(c => c.alias && c.alias.includes(commandText))) 
                    : null;

                // Number command logic: commands triggered by exact number text (like "1", "2", etc)
                const numberCmd = events.commands.find(c => c.on === 'number' && c.pattern === body);

                // Handle command (prefix commands)
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
                    return; // Command handled, exit
                }

                // Handle number command (no prefix, exact message number)
                if (numberCmd) {
                    try {
                        await numberCmd.function(conn, mek, m, { from, quoted, body, isCmd: false, command: numberCmd.pattern, args: [], q: '', isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                    } catch (e) {
                        console.error("[NUMBER CMD ERROR] " + e);
                        reply("⚠️ An error occurred while executing the number command.");
                    }
                    return; // Number command handled, exit
                }

                // Handle "body" type commands (commands triggered by matching body in any message)
                events.commands.map(async (command) => {
                    if (body && command.on === "body") {
                        try {
                            await command.function(conn, mek, m, { from, quoted, body, isCmd, command: command.pattern, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                        } catch (e) {
                            console.error("[BODY CMD ERROR] " + e);
                        }
                    }
                });
            } catch (error) {
                console.error("[MESSAGE HANDLER ERROR]", error);
            }
        });
    } catch (error) {
        console.error('Error in connectToWA:', error);
        console.log('Retrying connection in 10 seconds...');
        setTimeout(() => {
            connectToWA();
        }, 10000);
    }
}

app.get("/", (req, res) => {
    res.send("Hey, Senal started✅");
});

app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));

setTimeout(() => {
    connectToWA();
}, 4000);
