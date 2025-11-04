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

// Reconnection tracking
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

//===================SESSION-AUTH============================
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (config.SESSION_ID) {
        console.log('Downloading session from Mega.nz...');
        const sessdata = config.SESSION_ID;
        
        try {
            const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
            
            // Add timeout for session download
            const timeout = setTimeout(() => {
                console.log('⚠️ Session download timeout. Please check your SESSION_ID.');
                console.log('Proceeding with QR code authentication...');
            }, 30000); // 30 seconds
            
            filer.download((err, data) => {
                clearTimeout(timeout);
                if (err) {
                    console.log('❌ Failed to download session:', err.message);
                    console.log('Will use QR code instead');
                    return;
                }
                
                // Ensure directory exists
                if (!fs.existsSync(__dirname + '/auth_info_baileys')) {
                    fs.mkdirSync(__dirname + '/auth_info_baileys', { recursive: true });
                }
                
                fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, (writeErr) => {
                    if (writeErr) {
                        console.log('❌ Error saving session:', writeErr.message);
                    } else {
                        console.log("✅ Session downloaded successfully");
                    }
                });
            });
        } catch (error) {
            console.log('❌ Error with session download:', error.message);
            console.log('Will use QR code for authentication');
        }
    } else {
        console.log('ℹ️ No SESSION_ID found, will use QR code for authentication');
    }
} else {
    console.log('✅ Session file found');
}

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

//=============================================

async function connectToWA() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('❌ Max reconnection attempts reached. Please check your configuration.');
        console.log('💡 Try deleting the auth_info_baileys folder and restart the bot.');
        return;
    }
    
    reconnectAttempts++;
    console.log(`⏳ Connecting Senal MD BOT... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
        var { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            logger: P({ level: 'silent' }),
            printQRInTerminal: true,
            browser: Browsers.macOS("Firefox"),
            syncFullHistory: true,
            auth: state,
            version
        });

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'close') {
                // Properly handle the error object with optional chaining
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log('⚠️ Connection closed. Status code:', statusCode);
                console.log('Error details:', lastDisconnect?.error?.message || 'Unknown error');
                
                if (shouldReconnect) {
                    console.log('🔄 Attempting to reconnect...');
                    setTimeout(() => {
                        connectToWA();
                    }, 3000); // Wait 3 seconds before reconnecting
                } else {
                    console.log('🚪 Logged out. Please delete auth_info_baileys folder and scan QR code again.');
                    reconnectAttempts = 0; // Reset attempts on logout
                }
            } else if (connection === 'open') {
                console.log('🧬 Installing plugins...');
                reconnectAttempts = 0; // Reset attempts on successful connection
                
                const path = require('path');
                
                try {
                    // Check if plugins directory exists
                    if (!fs.existsSync('./plugins/')) {
                        console.log('⚠️ Plugins directory not found. Creating it...');
                        fs.mkdirSync('./plugins/', { recursive: true });
                    }
                    
                    const plugins = fs.readdirSync("./plugins/");
                    let pluginCount = 0;
                    
                    plugins.forEach((plugin) => {
                        if (path.extname(plugin).toLowerCase() === ".js") {
                            try {
                                require("./plugins/" + plugin);
                                pluginCount++;
                            } catch (err) {
                                console.log(`❌ Error loading plugin ${plugin}:`, err.message);
                            }
                        }
                    });
                    
                    console.log(`✅ ${pluginCount} plugins installed successfully`);
                    console.log('✅ Bot connected to WhatsApp');

                    let up = `Senal-MD connected successfully ✅\n\nPREFIX: ${prefix}\nPlugins loaded: ${pluginCount}`;

                    conn.sendMessage(ownerNumber + "@s.whatsapp.net", { 
                        image: { url: `https://files.catbox.moe/gm88nn.png` }, 
                        caption: up 
                    }).catch(err => {
                        console.log('⚠️ Could not send startup message:', err.message);
                    });
                } catch (error) {
                    console.error('❌ Error loading plugins:', error.message);
                }
            } else if (connection === 'connecting') {
                console.log('🔌 Connecting to WhatsApp...');
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
                const content = JSON.stringify(mek.message);
                const from = mek.key.remoteJid;
                const quoted = type == 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : [];
                const body = (type === 'conversation') ? mek.message.conversation : 
                             (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : 
                             (type == 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption : 
                             (type == 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : '';
                
                const isCmd = body.startsWith(prefix);
                const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
                const args = body.trim().split(/ +/).slice(1);
                const q = args.join(' ');
                const isGroup = from.endsWith('@g.us');
                const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid);
                const senderNumber = sender.split('@')[0];
                const botNumber = conn.user.id.split(':')[0];
                const pushname = mek.pushName || 'No Name';
                const isMe = botNumber.includes(senderNumber);
                const isOwner = ownerNumber.includes(senderNumber) || isMe;
                const botNumber2 = await jidNormalizedUser(conn.user.id);
                const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(e => { }) : '';
                const groupName = isGroup ? groupMetadata.subject : '';
                const participants = isGroup ? await groupMetadata.participants : '';
                const groupAdmins = isGroup ? await getGroupAdmins(participants) : '';
                const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false;
                const isAdmins = isGroup ? groupAdmins.includes(sender) : false;
                
                const reply = (teks) => {
                    conn.sendMessage(from, { text: teks }, { quoted: mek });
                };

                //=================== Commands =========================
                const events = require('./command');
                const cmdName = isCmd ? body.slice(1).trim().split(" ")[0].toLowerCase() : false;
                
                if (isCmd) {
                    const cmd = events.commands.find((cmd) => cmd.pattern === (cmdName)) || events.commands.find((cmd) => cmd.alias && cmd.alias.includes(cmdName));
                    if (cmd) {
                        if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });

                        try {
                            cmd.function(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                        } catch (e) {
                            console.error("[PLUGIN ERROR]", e);
                            reply("❌ An error occurred while executing this command.");
                        }
                    }
                }
                
                events.commands.map(async (command) => {
                    if (body && command.on === "body") {
                        try {
                            command.function(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                        } catch (e) {
                            console.error("[BODY COMMAND ERROR]", e);
                        }
                    }
                });
            } catch (error) {
                console.error("[MESSAGE HANDLING ERROR]", error);
            }
        });
    } catch (error) {
        console.error('❌ Fatal error in connectToWA:', error);
        setTimeout(() => {
            connectToWA();
        }, 5000);
    }
}

app.get("/", (req, res) => {
    res.send("✅ Hey, Senal MD Bot is running!");
});

app.listen(port, () => {
    console.log(`🌐 Server listening on port ${port}`);
});

// Wait for session download before connecting
setTimeout(() => {
    connectToWA();
}, 5000); // Increased to 5 seconds to allow session download
