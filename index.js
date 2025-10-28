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
        console.log('❌ SESSION_ID not found in environment variables!');
        console.log('Please add SESSION_ID to your .env file');
        process.exit(1);
    }
    const sessdata = config.SESSION_ID;
    try {
        console.log('Downloading session from MEGA...');
        const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
        filer.download((err, data) => {
            if (err) {
                console.error('❌ Failed to download session:', err.message);
                console.log('\n⚠️  Your SESSION_ID might be invalid or expired.');
                console.log('Please generate a new session using session-generator.js');
                process.exit(1);
            }
            fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, (writeErr) => {
                if (writeErr) {
                    console.error('❌ Failed to write session file:', writeErr);
                    process.exit(1);
                }
                console.log("✅ Session downloaded successfully");
            });
        });
    } catch (error) {
        console.error('❌ Error setting up session download:', error.message);
        process.exit(1);
    }
}

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

// Track reconnection attempts
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

//=============================================

async function connectToWA() {
    try {
        console.log("🔄 Connecting Senal MD BOT...");
        const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
        var { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            logger: P({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            syncFullHistory: false, // Changed to false for better performance
            auth: state,
            version,
            getMessage: async (key) => {
                return { conversation: 'hello' }
            }
        });

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Handle QR Code
            if (qr) {
                console.log('\n⚠️  QR Code detected! Scan with WhatsApp:');
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorReason = lastDisconnect?.error?.data?.reason;
                
                console.log('❌ Connection closed');
                console.log('Status Code:', statusCode);
                console.log('Reason:', lastDisconnect?.error?.message);
                
                // Handle 405 Error - Invalid/Expired Session
                if (statusCode === 405 || errorReason === '405') {
                    console.log('\n⚠️  ERROR 405: Session Invalid or Expired!');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('Your WhatsApp session is no longer valid.');
                    console.log('\nSOLUTIONS:');
                    console.log('1. Delete auth_info_baileys folder');
                    console.log('2. Generate new session with session-generator.js');
                    console.log('3. Upload new creds.json to MEGA');
                    console.log('4. Update SESSION_ID in .env');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                    
                    // Stop reconnection attempts for 405 errors
                    console.log('🛑 Stopping bot. Please fix the session issue.');
                    process.exit(1);
                }
                
                // Handle Logged Out
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('⚠️  Logged out from WhatsApp. Please scan QR code again.');
                    // Delete old session
                    if (fs.existsSync(__dirname + '/auth_info_baileys')) {
                        fs.rmSync(__dirname + '/auth_info_baileys', { recursive: true });
                        console.log('Old session deleted. Restart bot to scan new QR.');
                    }
                    process.exit(1);
                }
                
                // Handle other disconnections with retry limit
                reconnectAttempts++;
                if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
                    console.log(`❌ Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached.`);
                    console.log('Please check your session and restart manually.');
                    process.exit(1);
                }
                
                console.log(`🔄 Reconnecting... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                setTimeout(() => {
                    connectToWA();
                }, 5000);
                
            } else if (connection === 'open') {
                reconnectAttempts = 0; // Reset counter on successful connection
                console.log('✅ Connected to WhatsApp!');
                console.log('🧬 Loading plugins...');
                const path = require('path');
                
                try {
                    if (fs.existsSync("./plugins/")) {
                        const plugins = fs.readdirSync("./plugins/");
                        plugins.forEach((plugin) => {
                            if (path.extname(plugin).toLowerCase() === ".js") {
                                require("./plugins/" + plugin);
                            }
                        });
                        console.log(`✅ Loaded ${plugins.length} plugin(s)`);
                    } else {
                        console.log('⚠️  No plugins directory found');
                    }
                    
                    console.log('✅ Bot is ready!');
                    console.log(`📱 Prefix: ${prefix}`);

                    const startupMsg = `╔═══════════════════════╗
║   SENAL-MD STARTED    ║
╚═══════════════════════╝

✅ Status: Online
⚡ Prefix: ${prefix}
📅 Date: ${new Date().toLocaleString()}

Bot is ready to receive commands!`;

                    conn.sendMessage(ownerNumber + "@s.whatsapp.net", { 
                        text: startupMsg
                    }).catch(err => console.log('⚠️  Could not send startup message:', err.message));
                } catch (err) {
                    console.error('❌ Error during initialization:', err);
                }
            } else if (connection === 'connecting') {
                console.log('⏳ Connecting to WhatsApp servers...');
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

                // Number command logic
                const numberCmd = events.commands.find(c => c.on === 'number' && c.pattern === body);

                // Handle command (prefix commands)
                if (cmd) {
                    if (cmd.react) {
                        await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                    }
                    try {
                        await cmd.function(conn, mek, m, { from, quoted, body, isCmd, command: commandText, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                    } catch (e) {
                        console.error("[PLUGIN ERROR]", e);
                        reply("⚠️ An error occurred while executing the command.");
                    }
                    return;
                }

                // Handle number command
                if (numberCmd) {
                    try {
                        await numberCmd.function(conn, mek, m, { from, quoted, body, isCmd: false, command: numberCmd.pattern, args: [], q: '', isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                    } catch (e) {
                        console.error("[NUMBER CMD ERROR]", e);
                        reply("⚠️ An error occurred while executing the number command.");
                    }
                    return;
                }

                // Handle "body" type commands
                events.commands.map(async (command) => {
                    if (body && command.on === "body") {
                        try {
                            await command.function(conn, mek, m, { from, quoted, body, isCmd, command: command.pattern, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                        } catch (e) {
                            console.error("[BODY CMD ERROR]", e);
                        }
                    }
                });
            } catch (error) {
                console.error("[MESSAGE HANDLER ERROR]", error);
            }
        });
    } catch (error) {
        console.error('❌ Fatal error in connectToWA:', error);
        reconnectAttempts++;
        
        if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
            console.log('❌ Too many errors. Stopping bot.');
            process.exit(1);
        }
        
        console.log('🔄 Retrying in 10 seconds...');
        setTimeout(() => {
            connectToWA();
        }, 10000);
    }
}

app.get("/", (req, res) => {
    res.send("✅ Senal-MD is running!");
});

app.listen(port, () => console.log(`🌐 Server listening on port http://localhost:${port}`));

setTimeout(() => {
    connectToWA();
}, 4000);
