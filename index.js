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
const qrcode = require('qrcode-terminal')
const util = require('util')
const { sms, downloadMediaMessage } = require('./lib/msg')
const axios = require('axios')
const { File } = require('megajs')
const connectDB = require('./lib/mongodb')
const prefix = config.PREFIX || '.'

const ownerNumber = ['94769872326']

// Connect to MongoDB
connectDB().catch(err => {
    console.log('❌ MongoDB connection failed:', err.message);
});

//===================SESSION-AUTH============================
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (!config.SESSION_ID) return console.log('Please add your session to SESSION_ID env !!')
    const sessdata = config.SESSION_ID
    const filer = File.fromURL(`https://mega.nz/file/${sessdata}`)
    filer.download((err, data) => {
        if (err) throw err
        fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
            console.log("✅ Session downloaded")
        })
    })
}

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

//=============================================

async function connectToWA() {
    console.log("🔄 Connecting Senal MD BOT...");
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/')
    var { version } = await fetchLatestBaileysVersion()

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
            if (lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut) {
                connectToWA()
            }
        } else if (connection === 'open') {
            console.log('🧬 Installing plugins...')
            const path = require('path');
            fs.readdirSync("./plugins/").forEach((plugin) => {
                if (path.extname(plugin).toLowerCase() == ".js") {
                    require("./plugins/" + plugin);
                }
            });
            console.log('✅ Plugins installed successfully')
            console.log('✅ Bot connected to WhatsApp')

            // Show loaded commands for debugging
            const events = require('./command')
            console.log('📝 Loaded commands:', events.commands.length)
            console.log('📋 Commands list:', events.commands.map(c => c.pattern).join(', '))

            let up = `✅ Senal-MD Connected Successfully!\n\nPREFIX: ${prefix}\nMODE: ${config.MODE}\nCommands: ${events.commands.length}`;

            conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", { 
                image: { url: `https://files.catbox.moe/gm88nn.png` }, 
                caption: up 
            })
        }
    })

    conn.ev.on('creds.update', saveCreds)

    conn.ev.on('messages.upsert', async (mek) => {
        try {
            mek = mek.messages[0]
            if (!mek.message) return
            
            mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            
            if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_READ_STATUS === true) {
                await conn.readMessages([mek.key])
            }

            const m = sms(conn, mek)
            const type = getContentType(mek.message)
            const content = JSON.stringify(mek.message)
            const from = mek.key.remoteJid
            const quoted = type == 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : []
            const body = (type === 'conversation') ? mek.message.conversation : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : (type == 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption : (type == 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : ''
            const isCmd = body.startsWith(prefix)
            const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : ''
            const args = body.trim().split(/ +/).slice(1)
            const q = args.join(' ')
            const isGroup = from.endsWith('@g.us')
            const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid)
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

            //===================================work-type=========================================
            if (!isOwner && config.MODE === "private") return
            if (!isOwner && isGroup && config.MODE === "inbox") return
            if (!isOwner && !isGroup && config.MODE === "groups") return
            
            //====================react============================
            if (senderNumber.includes("94769872326")) {
                if (isReact) return
                m.react("👨‍💻")
            }

            // AUTO VOICE
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
                    console.log('Auto voice error:', e.message)
                }
            }

            // ============ COMMAND HANDLER ============
            const events = require('./command')

            // Debug logging for commands
            if (isCmd) {
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📥 Command:', command);
                console.log('👤 User:', pushname, `(${senderNumber})`);
                console.log('💬 Message:', body);
                console.log('📍 Chat:', isGroup ? groupName : 'Private Chat');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            }

            if (isCmd) {
                const cmd = events.commands.find((cmd) => cmd.pattern === command) ||
                    events.commands.find((cmd) => cmd.alias && cmd.alias.includes(command))

                if (cmd) {
                    console.log('✅ Command found:', cmd.pattern);
                    
                    // React if specified
                    if (cmd.react) {
                        await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } })
                    }

                    try {
                        await cmd.function(conn, mek, m, {
                            from,
                            quoted,
                            body,
                            isCmd,
                            command,
                            args,
                            q,
                            isGroup,
                            sender,
                            senderNumber,
                            botNumber2,
                            botNumber,
                            pushname,
                            isMe,
                            isOwner,
                            groupMetadata,
                            groupName,
                            participants,
                            groupAdmins,
                            isBotAdmins,
                            isAdmins,
                            reply
                        });
                        console.log('✅ Command executed successfully');
                    } catch (e) {
                        console.error("❌ [PLUGIN ERROR]", e);
                        reply(`❌ Error: ${e.message}`);
                    }
                } else {
                    console.log('⚠️ Command not found:', command);
                    console.log('Available commands:', events.commands.map(c => c.pattern).slice(0, 10).join(', '), '...');
                }
            }

            // Handle other event types (body, text, image, sticker)
            events.commands.map(async (cmdObj) => {
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
                    console.log('Event handler error:', e.message)
                }
            });

        } catch (e) {
            console.log('Message handler error:', e)
        }
    })
}

app.get("/", (req, res) => {
    res.send("✅ Senal MD is running!");
});

app.listen(port, () => console.log(`🌐 Server listening on port http://localhost:${port}`));

setTimeout(() => {
    connectToWA()
}, 4000);
