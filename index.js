// index.js (replace your current main script with this)
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys')

const { getBuffer, getGroupAdmins } = require('./lib/functions')
const fs = require('fs')
const path = require('path')
const P = require('pino')
const config = require('./config')
const axios = require('axios')
const { File } = require('megajs')
const express = require('express')
const qrcode = require('qrcode-terminal')
const { sms } = require('./lib/msg')

const prefix = '.'
const ownerNumber = ['94769872326']
const app = express()
const port = process.env.PORT || 8000

// Global error handlers
process.on('unhandledRejection', (r) => console.error('Unhandled Rejection:', r))
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err))

/**
 * Download session file from Mega (if SESSION_ID provided)
 * Returns when file is written to auth directory.
 */
async function ensureSessionFile() {
  try {
    const credsPath = path.join(__dirname, 'auth_info_baileys', 'creds.json')
    if (fs.existsSync(credsPath)) {
      console.log('Session creds found locally ✅')
      return
    }

    if (!config.SESSION_ID) {
      console.log('Please add your session to SESSION_ID env !!')
      return
    }

    console.log('Downloading session from Mega... ⏳')
    const sessdata = config.SESSION_ID
    const filer = File.fromURL(`https://mega.nz/file/${sessdata}`)

    await new Promise((resolve, reject) => {
      filer.download((err, data) => {
        if (err) return reject(err)
        // ensure directory exists
        const dir = path.dirname(credsPath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFile(credsPath, data, (werr) => {
          if (werr) return reject(werr)
          console.log('Session downloaded ✅')
          resolve()
        })
      })
    })
  } catch (e) {
    console.error('Failed to download session:', e)
    throw e
  }
}

/**
 * Load plugins from plugins/ directory (safe)
 * returns array of filenames loaded
 */
function loadPlugins() {
  const pluginsDir = path.join(__dirname, 'plugins')
  try {
    if (!fs.existsSync(pluginsDir)) {
      console.warn(`Plugins directory missing: ${pluginsDir}`)
      return []
    }
    const files = fs.readdirSync(pluginsDir)
    const jsfiles = files.filter(f => path.extname(f).toLowerCase() === '.js')
    console.log('Loading plugins from:', pluginsDir)
    jsfiles.forEach((plugin) => {
      const pluginPath = path.join(pluginsDir, plugin)
      try {
        require(pluginPath)
        console.log('Loaded plugin:', plugin)
      } catch (e) {
        console.error(`⚠️ Failed to load plugin ${plugin}:`, e.message)
      }
    })
    return jsfiles
  } catch (e) {
    console.error('Error reading plugins folder:', e)
    return []
  }
}

async function connectToWA() {
  try {
    console.log('Connecting Senal MD BOT ⏳️...')
    await ensureSessionFile()

    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'))
    const { version } = await fetchLatestBaileysVersion()

    const conn = makeWASocket({
      logger: P({ level: 'silent' }),
      printQRInTerminal: false,
      browser: Browsers.macOS('Firefox'),
      syncFullHistory: true,
      auth: state,
      version
    })

    // Load plugins once on open (or you can call earlier if you want)
    conn.ev.on('connection.update', (update) => {
      try {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
          const shouldReconnect = !(lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut)
          console.log('Connection closed. Should reconnect?', shouldReconnect)
          if (shouldReconnect) {
            setTimeout(() => connectToWA(), 3000)
          } else {
            console.log('Logged out from WhatsApp. Remove session and re-authenticate.')
          }
        } else if (connection === 'open') {
          console.log('🧬 Installing plugins...')
          loadPlugins()
          console.log('Plugins installed successful ✅')
          console.log('Bot connected to WhatsApp ✅')

          const up = `Senal-MD connected successful ✅\n\nPREFIX: ${prefix}`
          const ownerJid = ownerNumber.map(n => `${n}@s.whatsapp.net`)
          ownerJid.forEach(jid => {
            conn.sendMessage(jid, { image: { url: 'https://files.catbox.moe/gm88nn.png' }, caption: up }).catch(() => {})
          })
        }
      } catch (e) {
        console.error('Error in connection.update handler:', e)
      }
    })

    conn.ev.on('creds.update', saveCreds)

    // messages.upsert handler
    conn.ev.on('messages.upsert', async (mek_) => {
      try {
        if (!mek_ || !mek_.messages || !mek_.messages[0]) return
        let mek = mek_.messages[0]

        if (!mek.message) return
        // unwrap ephemeral
        if (getContentType(mek.message) === 'ephemeralMessage' && mek.message.ephemeralMessage) {
          mek.message = mek.message.ephemeralMessage.message
        }

        // auto-read status updates if enabled
        if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_READ_STATUS === 'true') {
          try { await conn.readMessages([mek.key]) } catch (e) {}
        }

        const m = sms(conn, mek) // your wrapper from ./lib/msg
        const type = getContentType(mek.message)
        const from = mek.key.remoteJid
        const contentStr = JSON.stringify(mek.message)
        const quoted = (type === 'extendedTextMessage' && mek.message.extendedTextMessage?.contextInfo) ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : []
        const body = (type === 'conversation') ? mek.message.conversation
          : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text
          : (type === 'imageMessage' && mek.message.imageMessage?.caption) ? mek.message.imageMessage.caption
          : (type === 'videoMessage' && mek.message.videoMessage?.caption) ? mek.message.videoMessage.caption
          : ''

        // if no text body, do nothing
        if (!body) return

        const isCmd = body.startsWith(prefix)
        const cmdName = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : ''
        const args = body.trim().split(/ +/).slice(1)
        const q = args.join(' ')
        const isGroup = from.endsWith('@g.us')
        const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid)
        const senderNumber = (sender || '').split('@')[0]
        const botNumber = conn.user.id.split(':')[0]
        const pushname = mek.pushName || 'Sin Nombre'
        const isMe = botNumber.includes(senderNumber)
        const isOwner = ownerNumber.includes(senderNumber) || isMe
        const botNumber2 = await jidNormalizedUser(conn.user.id)
        const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(() => ({})) : {}
        const groupName = isGroup ? groupMetadata.subject : ''
        const participants = isGroup ? (groupMetadata.participants || []) : []
        const groupAdmins = isGroup ? await getGroupAdmins(participants) : []
        const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false
        const isAdmins = isGroup ? groupAdmins.includes(sender) : false
        const isReact = !!m.message.reactionMessage
        const reply = (teks) => conn.sendMessage(from, { text: teks }, { quoted: mek }).catch(() => {})

        // small helper to send files via url
        conn.sendFileUrl = async (jid, url, caption = '', quotedMsg = mek, options = {}) => {
          try {
            let res = await axios.head(url)
            let mime = res.headers['content-type'] || ''
            if (!mime) mime = ''
            const mainType = mime.split('/')[0] || ''

            if (mime.includes('gif')) {
              return conn.sendMessage(jid, { video: await getBuffer(url), caption, gifPlayback: true, ...options }, { quoted: quotedMsg })
            }
            if (mime === 'application/pdf') {
              return conn.sendMessage(jid, { document: await getBuffer(url), mimetype: 'application/pdf', caption, ...options }, { quoted: quotedMsg })
            }
            if (mainType === 'image') {
              return conn.sendMessage(jid, { image: await getBuffer(url), caption, ...options }, { quoted: quotedMsg })
            }
            if (mainType === 'video') {
              return conn.sendMessage(jid, { video: await getBuffer(url), caption, mimetype: 'video/mp4', ...options }, { quoted: quotedMsg })
            }
            if (mainType === 'audio') {
              return conn.sendMessage(jid, { audio: await getBuffer(url), caption, mimetype: 'audio/mpeg', ...options }, { quoted: quotedMsg })
            }
            // fallback: send text link
            return conn.sendMessage(jid, { text: `${caption}\n\n${url}` }, { quoted: quotedMsg })
          } catch (e) {
            console.error('sendFileUrl error:', e)
          }
        }

        // =================================== work-type filters ==================================
        if (!isOwner && config.MODE === 'private') return
        if (!isOwner && isGroup && config.MODE === 'inbox') return
        if (!isOwner && !isGroup && config.MODE === 'groups') return

        // auto react for ownerNumber (example)
        if (senderNumber && senderNumber.includes('94769872326')) {
          if (!isReact) {
            try { await m.react('👨‍💻') } catch (_) {}
          }
        }

        // debug logs (remove or comment out later)
        if (isCmd) {
          console.log('🧠 Command detected:', cmdName)
          try {
            const events = require('./command')
            console.log('📦 Loaded commands:', events.commands.map(c => c.pattern))
          } catch (e) {
            console.warn('Could not load command list for debug:', e.message)
          }
        } else {
          // console.log('Message body (non-cmd):', body)
        }

        // load command registry
        const events = require('./command')

        // Inline quick test command (useful for debugging)
        if (isCmd && cmdName === 'ping') {
          return reply('pong ✅')
        }

        // primary command matching
        if (isCmd) {
          const cmd = events.commands.find((c) => c.pattern === cmdName) || events.commands.find((c) => (c.alias && c.alias.includes(cmdName)))
          if (cmd) {
            if (cmd.react) {
              try { conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } }) } catch (_) {}
            }
            try {
              await cmd.function(conn, mek, m, {
                from, quoted, body, isCmd, command: cmdName, args, q, isGroup, sender, senderNumber,
                botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants,
                groupAdmins, isBotAdmins, isAdmins, reply
              })
            } catch (e) {
              console.error(`[PLUGIN ERROR] in ${cmd.pattern || 'unknown'}:`, e)
              try { reply('An error occurred while executing this command.') } catch (_) {}
            }
          }
        }

        // event-based commands
        events.commands.map(async (command) => {
          try {
            if (body && command.on === 'body') {
              command.function(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply })
            } else if (mek?.q && command.on === 'text') {
              command.function(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply })
            } else if ((command.on === 'image' || command.on === 'photo') && mek.type === 'imageMessage') {
              command.function(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply })
            } else if (command.on === 'sticker' && mek.type === 'stickerMessage') {
              command.function(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply })
            }
          } catch (err) {
            console.error(`Error running event command ${command.pattern || 'unknown'}:`, err)
          }
        })
      } catch (e) {
        console.error('[MESSAGE HANDLER ERROR]', e)
      }
    }) // end messages.upsert

  } catch (e) {
    console.error('connectToWA error:', e)
    // try to reconnect after short delay
    setTimeout(() => {
      try { connectToWA() } catch (_) {}
    }, 5000)
  }
} // end connectToWA

// Express route for health checks
app.get('/', (req, res) => res.send('hey, senal started✅'))
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`))

// start
setTimeout(() => {
  connectToWA()
}, 4000)
