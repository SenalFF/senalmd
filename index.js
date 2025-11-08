// ============ RAILWAY KEEP-ALIVE FIX ============
process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM received - keeping bot alive');
});

process.on('SIGINT', () => {
    console.log('⚠️ SIGINT received - keeping bot alive');
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys')

const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions')
const fs = require('fs')
const P = require('pino')
const config = require('./config')
const { sms, downloadMediaMessage } = require('./lib/msg')
const axios = require('axios')
const { File } = require('megajs')
const connectDB = require('./lib/mongodb')
const prefix = config.PREFIX || '.'

const ownerNumber = ['94769872326']

// ============ EXPRESS SERVER (REQUIRED FOR RAILWAY) ============
const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(express.json());

// Root endpoint
app.get("/", (req, res) => {
    res.json({
        status: "✅ Senal MD is running!",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ 
        status: "alive", 
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// Start server IMMEDIATELY (before bot connection)
const server = app.listen(port, () => {
    console.log(`🌐 Server listening on port ${port}`);
    console.log(`✅ Railway HTTP service ready`);
});

// Keep-alive ping every 5 minutes
setInterval(() => {
    console.log('💚 Bot alive -', new Date().toLocaleTimeString());
}, 300000);

// ============ MONGODB CONNECTION ============
connectDB().catch(err => {
    console.log('❌ MongoDB failed:', err.message);
});

// ============ SESSION AUTH ============
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (!config.SESSION_ID) {
        console.log('❌ Please add SESSION_ID to env!')
        process.exit(1)
    }
    const sessdata = config.SESSION_ID
    const filer = File.fromURL(`https://mega.nz/file/${sessdata}`)
    filer.download((err, data) => {
        if (err) {
            console.error('❌ Session download failed:', err)
            process.exit(1)
        }
        fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
            console.log("✅ Session downloaded")
        })
    })
}

// ============ WHATSAPP CONNECTION ============
async function connectToWA() {
    console.log("🔄 Connecting Senal MD BOT...");
    
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/')
    const { version } = await fetchLatestBaileysVersion()

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS("Firefox"),
        syncFullHistory: true,
        auth: state,
        version
    })

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('🔴 Connection closed. Reconnecting:', shouldReconnect)
            
            if (shouldReconnect) {
                setTimeout(() => connectToWA(), 3000)
            }
        } else if (connection === 'open') {
            console.log('🧬 Installing plugins...')
            
            const path = require('path');
            fs.readdirSync("./plugins/").forEach((plugin) => {
                if (path.extname(plugin).toLowerCase() == ".js") {
                    require("./plugins/" + plugin);
                }
            });
            
            console.log('✅ Plugins installed')
            console.log('✅ Bot connected to WhatsApp')

            const events = require('./command')
            const validCommands = events.commands.filter(c => c.pattern && c.pattern.trim() !== '')
            
            console.log('📝 Total commands:', events.commands.length)
            console.log('✅ Valid commands:', validCommands.length)
            console.log('📋 List:', validCommands.map(c => c.pattern).join(', '))
            console.log('🎧 Listening for messages...')

            const up = `✅ Senal-MD Connected!\n\nPREFIX: ${prefix}\nMODE: ${config.MODE}\nCommands: ${validCommands.length}`;

            conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", { 
                image: { url: `https://files.catbox.moe/gm88nn.png` }, 
                caption: up 
            }).catch(err => console.log('Startup msg failed:', err.message))
        }
    })

    conn.ev.on('creds.update', saveCreds)

    conn.ev.on('messages.upsert', async (mek) => {
        try {
            mek = mek.messages[0]
            if (!mek.message) return
            
            console.log('📨 Message received')
            
            mek.message = (getContentType(mek.message) === 'ephemeralMessage') 
                ? mek.message.ephemeralMessage.message 
                : mek.message
            
            // Skip status updates
            if (mek.key?.remoteJid === 'status@broadcast') {
                if (config.AUTO_READ_STATUS === true) {
                    await conn.readMessages([mek.key])
                }
                return
            }

            const m = sms(conn, mek)
            const type = getContentType(mek.message)
            const from = mek.key.remoteJid
            const quoted = type == 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null 
                ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] 
                : []
            
            const body = (type === 'conversation') ? mek.message.conversation 
                : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text 
                : (type == 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption 
                : (type == 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption 
                : ''
            
            console.log('📝 Body:', body)
            
            const isCmd = body.startsWith(prefix)
            const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : ''
            const args = body.trim().split(/ +/).slice(1)
            const q = args.join(' ')
            const isGroup = from.endsWith('@g.us')
            const sender = mek.key.fromMe 
                ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id) 
                : (mek.key.participant || mek.key.remoteJid)
            const senderNumber = sender.split('@')[0]
            const botNumber = conn.user.id.split(':')[0]
            const pushname = mek.pushName || 'No Name'
            const isMe = botNumber.includes(senderNumber)
            const isOwner = ownerNumber.includes(senderNumber) || isMe
            const botNumber2 = await jidNormalizedUser(conn.user.id);
            const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(e => {}) : ''
            const groupName = isGroup ? groupMetadata.subject : ''
            const participants = isGroup ? await groupMetadata.participants : ''
            const groupAdmins = isGroup ? await getGroupAdmins(participants) : ''
            const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false
            const isAdmins = isGroup ? groupAdmins.includes(sender) : false
            const isReact = m.message.reactionMessage ? true : false

            const reply = (teks) => {
                conn.sendMessage(from, { text: teks }, { quoted: mek })
            }

            conn.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
                let mime = '';
                let res = await axios.head(url)
                mime = res.headers['content-type']
                if (mime.split("/")[1] === "gif") {
                    return conn.sendMessage(jid, { video: await getBuffer(url), caption: caption, gifPlayback: true, ...options }, { quoted: quoted, ...options })
                }
                let type = mime.split("/")[0] + "Message"
                if (mime === "application/pdf") {
                    return conn.sendMessage(jid, { document: await getBuffer(url), mimetype: 'application/pdf', caption: caption, ...options }, { quoted: quoted, ...options })
                }
                if (mime.split("/")[0] === "image") {
                    return conn.sendMessage(jid, { image: await getBuffer(url), caption: caption, ...options }, { quoted: quoted, ...options })
                }
                if (mime.split("/")[0] === "video") {
                    return conn.sendMessage(jid, { video: await getBuffer(url), caption: caption, mimetype: 'video/mp4', ...options }, { quoted: quoted, ...options })
                }
                if (mime.split("/")[0] === "audio") {
                    return conn.sendMessage(jid, { audio: await getBuffer(url), caption: caption, mimetype: 'audio/mpeg', ...options }, { quoted: quoted, ...options })
                }
            }

            // Work type check
            console.log('🔒 MODE:', config.MODE, 'Owner:', isOwner, 'Group:', isGroup)
            
            if (!isOwner && config.MODE === "private") {
                console.log('⛔ Blocked: Private mode')
                return
            }
            if (!isOwner && isGroup && config.MODE === "inbox") {
                console.log('⛔ Blocked: Inbox mode')
                return
            }
            if (!isOwner && !isGroup && config.MODE === "groups") {
                console.log('⛔ Blocked: Groups mode')
                return
            }
            
            console.log('✅ Mode passed')
            
            // Owner react
            if (senderNumber.includes("94769872326") && !isReact) {
                m.react("👨‍💻")
            }

            // Auto voice
            if (config.AUTO_VOICE === true) {
                try {
                    const url = 'https://raw.githubusercontent.com/DarkYasiyaofc/VOICE/main/Voice-Raw/FROZEN-V2'
                    let { data } = await axios.get(url)
                    for (let vr in data) {
                        if ((new RegExp(`\\b${vr}\\b`, 'gi')).test(body)) {
                            conn.sendMessage(from, { audio: { url: data[vr] }, mimetype: 'audio/mpeg', ptt: true }, { quoted: mek })
                        }
                    }
                } catch (e) {
                    console.log('Voice error:', e.message)
                }
            }

            // Command handler
            const events = require('./command')

            if (isCmd) {
                console.log('━━━━━━━━━━━━━━━━━━━━');
                console.log('📥 Cmd:', command);
                console.log('👤 User:', pushname);
                console.log('💬 Msg:', body);
                console.log('📍 From:', isGroup ? groupName : 'DM');
                console.log('━━━━━━━━━━━━━━━━━━━━');
                
                const validCommands = events.commands.filter(c => c.pattern && c.pattern.trim() !== '')
                const cmd = validCommands.find((cmd) => cmd.pattern === command) ||
                    validCommands.find((cmd) => cmd.alias && cmd.alias.includes(command))

                if (cmd) {
                    console.log('✅ Found:', cmd.pattern);
                    
                    if (cmd.react) {
                        await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } })
                    }

                    try {
                        await cmd.function(conn, mek, m, {
                            from, quoted, body, isCmd, command, args, q, isGroup,
                            sender, senderNumber, botNumber2, botNumber, pushname,
                            isMe, isOwner, groupMetadata, groupName, participants,
                            groupAdmins, isBotAdmins, isAdmins, reply
                        });
                        console.log('✅ Executed');
                    } catch (e) {
                        console.error("❌ Error:", e.message);
                        reply(`❌ Error: ${e.message}`);
                    }
                } else {
                    console.log('⚠️ Not found:', command);
                }
            }

            // Event handlers
            events.commands.forEach(async (cmdObj) => {
                try {
                    if (body && cmdObj.on === "body") {
                        cmdObj.function(conn, mek, m, {
                            from, quoted, body, isCmd, command, args, q, isGroup,
                            sender, senderNumber, botNumber2, botNumber, pushname,
                            isMe, isOwner, groupMetadata, groupName, participants,
                            groupAdmins, isBotAdmins, isAdmins, reply
                        })
                    } else if (mek.message && cmdObj.on === "text") {
                        cmdObj.function(conn, mek, m, {
                            from, quoted, body, isCmd, command, args, q, isGroup,
                            sender, senderNumber, botNumber2, botNumber, pushname,
                            isMe, isOwner, groupMetadata, groupName, participants,
                            groupAdmins, isBotAdmins, isAdmins, reply
                        })
                    } else if ((cmdObj.on === "image" || cmdObj.on === "photo") && type === "imageMessage") {
                        cmdObj.function(conn, mek, m, {
                            from, quoted, body, isCmd, command, args, q, isGroup,
                            sender, senderNumber, botNumber2, botNumber, pushname,
                            isMe, isOwner, groupMetadata, groupName, participants,
                            groupAdmins, isBotAdmins, isAdmins, reply
                        })
                    } else if (cmdObj.on === "sticker" && type === "stickerMessage") {
                        cmdObj.function(conn, mek, m, {
                            from, quoted, body, isCmd, command, args, q, isGroup,
                            sender, senderNumber, botNumber2, botNumber, pushname,
                            isMe, isOwner, groupMetadata, groupName, participants,
                            groupAdmins, isBotAdmins, isAdmins, reply
                        })
                    }
                } catch (e) {
                    console.log('Event error:', e.message)
                }
            });

        } catch (e) {
            console.log('❌ Handler error:', e.message)
        }
    })
}

// Start WhatsApp connection after server is ready
setTimeout(() => {
    connectToWA()
}, 2000);
