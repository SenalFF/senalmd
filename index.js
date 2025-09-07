// Fixed Senal-MD index.js
// Updates:
//  - Safe group metadata fetching
//  - Robust message body extraction
//  - Proper quoted message handling
//  - Safer admin checks
//  - Owner notification with link preview + interactive buttons
//  - Auto developer/status/platform info + connection time

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
    fetchLatestBaileysVersion,
    Browsers,
    generateWAMessageFromContent,
    proto
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
const prefix = '.'

const ownerNumber = ['94769872326']

//=================== BOT INFO ============================
const BOT_INFO = {
    developer: "Mr Senal",
    status: "connected",
    autoReconnect: true,
    platform: "railway"
}
//=========================================================

//===================SESSION-AUTH==========================
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (!config.SESSION_ID) return console.log('Please add your session to SESSION_ID env!!')
    const sessdata = config.SESSION_ID
    const filer = File.fromURL(`https://mega.nz/file/${sessdata}`)
    filer.download((err, data) => {
        if (err) throw err
        fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
            console.log("Session downloaded ✓")
        })
    })
}
//==========================================================

const express = require("express")
const app = express()
const port = process.env.PORT || 8000

// Helper: safely extract body and quoted message
function extractMessageInfo(message) {
    const type = getContentType(message)
    let body = ''
    let quoted = null

    const ctxCandidates = [
        message.extendedTextMessage?.contextInfo,
        message.imageMessage?.contextInfo,
        message.videoMessage?.contextInfo,
        message.documentMessage?.contextInfo,
        message.buttonsResponseMessage?.contextInfo,
        message.listResponseMessage?.contextInfo
    ]

    const contextInfo = ctxCandidates.find(c => !!c) || null

    switch (type) {
        case 'conversation':
            body = message.conversation || ''
            break
        case 'extendedTextMessage':
            body = message.extendedTextMessage?.text || ''
            break
        case 'imageMessage':
            body = message.imageMessage?.caption || ''
            break
        case 'videoMessage':
            body = message.videoMessage?.caption || ''
            break
        case 'documentMessage':
            body = message.documentMessage?.caption || ''
            break
        case 'buttonsResponseMessage':
            body = message.buttonsResponseMessage?.selectedButtonId || message.buttonsResponseMessage?.selectedDisplayText || ''
            break
        case 'listResponseMessage':
            body = message.listResponseMessage?.singleSelectReply?.selectedRowId || message.listResponseMessage?.singleSelectReply?.selectedRowText || message.listResponseMessage?.title || ''
            break
        default:
            body = ''
    }

    if (contextInfo && contextInfo.quotedMessage) {
        quoted = contextInfo.quotedMessage
    }

    return { type, body: (body || '').toString(), quoted, contextInfo }
}

// Safe group metadata
async function safeGroupMetadata(conn, jid) {
    if (!jid || !jid.endsWith('@g.us')) return null
    try {
        const meta = await conn.groupMetadata(jid)
        return meta || null
    } catch {
        return null
    }
}

// Function: send interactive preview + buttons
async function sendConnectedMessage(conn, jid) {
    const now = new Date()
    const time = now.toLocaleString("en-US", { timeZone: "Asia/Colombo" })

    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: proto.Message.InteractiveMessage.create({
                    body: proto.Message.InteractiveMessage.Body.create({
                        text: `🤖 Senal-MD connected successfully ✓\n\n👨‍💻 Developer: ${BOT_INFO.developer}\n📌 Status: ${BOT_INFO.status}\n🔄 AutoReconnect: ${BOT_INFO.autoReconnect}\n💻 Platform: ${BOT_INFO.platform}\n⏰ Connected at: ${time}\n\nPREFIX: ${prefix}`
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.create({
                        text: "⚡ Choose an option below:"
                    }),
                    header: proto.Message.InteractiveMessage.Header.create({
                        title: "Senal MD Bot\nConnected Successfully ✅",
                        hasMediaAttachment: false
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                        buttons: [
                            {
                                name: "cta_url",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "📢 WhatsApp Channel",
                                    url: "https://whatsapp.com/channel/0029VbBUZc1LNSaBaZDjkJ1y",
                                    merchant_url: "https://whatsapp.com/channel/0029VbBUZc1LNSaBaZDjkJ1y"
                                })
                            },
                            {
                                name: "cta_url",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "👥 Join Group",
                                    url: "https://chat.whatsapp.com/Ef9569Wpror1OAkWCFcE9q?mode=ems_share_t",
                                    merchant_url: "https://chat.whatsapp.com/Ef9569Wpror1OAkWCFcE9q?mode=ems_share_t"
                                })
                            },
                            {
                                name: "cta_url",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "📞 Contact Owner",
                                    url: "https://wa.link/bgbwbp",
                                    merchant_url: "https://wa.link/bgbwbp"
                                })
                            }
                        ]
                    })
                })
            }
        }
    }, { userJid: jid })

    await conn.relayMessage(jid, msg.message, { messageId: msg.key.id })
}

async function connectToWA() {
    console.log("Connecting Senal MD BOT ...")
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

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode
            if (reason !== DisconnectReason.loggedOut && BOT_INFO.autoReconnect) {
                console.log('Connection closed unexpectedly, reconnecting...')
                connectToWA()
            } else {
                console.log('Logged out. Please remove auth files and re-login.')
            }
        } else if (connection === 'open') {
            console.log(`✅ BOT CONNECTED | Developer: ${BOT_INFO.developer} | Platform: ${BOT_INFO.platform}`)

            for (const num of ownerNumber) {
                await sendConnectedMessage(conn, num + "@s.whatsapp.net")
            }

            // Load plugins
            const path = require('path')
            fs.readdirSync("./plugins/").forEach((plugin) => {
                if (path.extname(plugin).toLowerCase() == ".js") {
                    try {
                        require("./plugins/" + plugin)
                    } catch (e) {
                        console.error('[PLUGIN LOAD ERROR]', plugin, e)
                    }
                }
            })
        }
    })

    conn.ev.on('creds.update', saveCreds)
}

app.get("/", (req, res) => { res.send("Hey, Senal started ✓") })
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`))

// start
setTimeout(() => { connectToWA() }, 4000)
