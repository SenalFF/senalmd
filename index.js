// ================== ERROR HANDLING & RAILWAY KEEP-ALIVE ==================
process.on('SIGTERM', () => console.log('⚠️ SIGTERM received - keeping bot alive'));
process.on('SIGINT', () => console.log('⚠️ SIGINT received - keeping bot alive'));
process.on('uncaughtException', (err) => console.error('❌ Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('❌ Unhandled Rejection:', reason));

// ================== MODULE IMPORTS ==================
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const { getBuffer, getGroupAdmins, sms } = require('./lib/functions');
const fs = require('fs');
const P = require('pino');
const config = require('./config');
const axios = require('axios');
const connectDB = require('./lib/mongodb');
const prefix = config.PREFIX || '.';
const ownerNumber = ['94769872326'];

// ================== EXPRESS SERVER ==================
const express = require('express');
const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());

app.get('/', (req, res) => res.json({ status: "✅ Senal MD is running!", uptime: process.uptime(), timestamp: new Date().toISOString() }));
app.get('/health', (req, res) => res.json({ status: "alive", uptime: Math.floor(process.uptime()), memory: process.memoryUsage(), timestamp: new Date().toISOString() }));

app.listen(port, () => console.log(`🌐 Server listening on port ${port}`));

// Keep-alive log
setInterval(() => console.log('💚 Bot alive -', new Date().toLocaleTimeString()), 300000);

// ================== MONGODB ==================
connectDB().catch(err => console.log('❌ MongoDB failed:', err.message));

// ================== SESSION DOWNLOAD ==================
async function downloadSession() {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
            console.log('✅ Session file exists');
            return resolve();
        }

        if (!config.SESSION_ID) {
            console.log('❌ Please add SESSION_ID to env!');
            return reject(new Error('No SESSION_ID'));
        }

        console.log('📥 Downloading session...');
        const filer = require('megajs').File.fromURL(`https://mega.nz/file/${config.SESSION_ID}`);
        filer.download((err, data) => {
            if (err) {
                console.error('❌ Session download failed:', err);
                return reject(err);
            }
            fs.writeFileSync(__dirname + '/auth_info_baileys/creds.json', data);
            console.log('✅ Session downloaded successfully');
            resolve();
        });
    });
}

// ================== WHATSAPP CONNECTION ==================
async function connectToWA() {
    console.log('🔄 Connecting Senal MD BOT...');

    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS('Firefox'),
        auth: state,
        version
    });

    // ============ CONNECTION EVENTS ============
    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔴 Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) setTimeout(connectToWA, 3000);
        } else if (connection === 'open') {
            console.log('✅ Bot connected to WhatsApp');
            console.log('🧬 Installing plugins...');
            const path = require('path');
            fs.readdirSync('./plugins/').forEach(p => {
                if (path.extname(p) === '.js') {
                    try {
                        require('./plugins/' + p);
                        console.log(`✅ Loaded: ${p}`);
                    } catch (e) {
                        console.log(`❌ Failed to load ${p}:`, e.message);
                    }
                }
            });
            console.log('✅ Plugins installed');

            const events = require('./command');
            const validCommands = events.commands.filter(c => c.pattern && c.pattern.trim() !== '');
            console.log('📝 Total commands:', events.commands.length);
            console.log('✅ Valid commands:', validCommands.length);
            console.log('📋 List:', validCommands.map(c => c.pattern).join(', '));

            // Startup message to owner
            const msg = `✅ Senal-MD Connected!\nPREFIX: ${prefix}\nMODE: ${config.MODE}\nCommands: ${validCommands.length}`;
            conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
                image: { url: 'https://files.catbox.moe/gm88nn.png' },
                caption: msg
            }).catch(e => console.log('❌ Failed to send startup message:', e.message));
        }
    });

    conn.ev.on('creds.update', saveCreds);

    // ============ MESSAGE HANDLER ============
    conn.ev.on('messages.upsert', async (m) => {
        try {
            let mek = m.messages[0];
            if (!mek.message) return;

            const type = getContentType(mek.message);
            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net') : (mek.key.participant || mek.key.remoteJid);
            const senderNumber = sender.split('@')[0];
            const pushname = mek.pushName || 'No Name';
            const isOwner = ownerNumber.includes(senderNumber) || mek.key.fromMe;

            // Skip status updates
            if (from === 'status@broadcast') return;

            const body = type === 'conversation' ? mek.message.conversation
                : type === 'extendedTextMessage' ? mek.message.extendedTextMessage.text
                : type === 'imageMessage' && mek.message.imageMessage.caption ? mek.message.imageMessage.caption
                : type === 'videoMessage' && mek.message.videoMessage.caption ? mek.message.videoMessage.caption
                : '';

            // Log all messages for debugging
            console.log(`📨 Message from ${pushname}: "${body}"`);

            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(' ');

            const reply = (text) => conn.sendMessage(from, { text }, { quoted: mek });

            // ============ COMMAND BLOCK MODES ============
            if (!isOwner && config.MODE === 'private') {
                console.log('⛔ Private mode - ignoring non-owner');
                return;
            }
            if (!isOwner && isGroup && config.MODE === 'inbox') {
                console.log('⛔ Inbox mode - ignoring group message from non-owner');
                return;
            }
            if (!isOwner && !isGroup && config.MODE === 'groups') {
                console.log('⛔ Groups mode - ignoring inbox message from non-owner');
                return;
            }

            // ============ OWNER AUTO REACT ============
            if (isOwner && !mek.message.reactionMessage) {
                conn.sendMessage(from, { react: { text: '👨‍💻', key: mek.key } }).catch(() => {});
            }

            // ============ COMMAND HANDLER ============
            if (isCmd) {
                console.log(`🔍 Command detected: "${command}" with args: [${args.join(', ')}]`);
                
                const events = require('./command');
                const validCommands = events.commands.filter(c => c.pattern && c.pattern.trim() !== '');
                
                // Try exact match first
                let cmdObj = validCommands.find(c => c.pattern === command);
                
                // Try alias match if no exact match
                if (!cmdObj) {
                    cmdObj = validCommands.find(c => c.alias?.includes(command));
                }

                if (cmdObj) {
                    console.log(`✅ Found command handler for: ${command}`);
                    try {
                        await cmdObj.function(conn, mek, sms(conn, mek), {
                            from, body, isCmd, command, args, q, isGroup,
                            sender, senderNumber, pushname, isOwner, reply
                        });
                        console.log(`✅ Executed: ${command} by ${pushname} (${senderNumber})`);
                    } catch (e) {
                        console.error(`❌ Plugin error for ${command}:`, e);
                        reply(`❌ Error executing command: ${e.message}`);
                    }
                } else {
                    console.log(`⚠️ Command not found: ${command}`);
                    console.log(`📋 Available commands: ${validCommands.map(c => c.pattern).join(', ')}`);
                    // Optionally send a reply
                    // reply(`❓ Unknown command: ${command}\nUse ${prefix}menu to see available commands`);
                }
            }
        } catch (e) {
            console.error('❌ Handler error:', e);
            console.error('Stack trace:', e.stack);
        }
    });
}

// ================== START BOT ==================
(async () => {
    try {
        await downloadSession();
        setTimeout(connectToWA, 2000);
    } catch (e) {
        console.error('❌ Failed to start bot:', e);
        process.exit(1);
    }
})();
