// lib/uploading.js

const axios = require('axios')
const fs = require('fs')
const FormData = require('form-data')
const path = require('path')
const mime = require('mime-types')

const GOFILE_API = 'https://api.gofile.io'
const ACCOUNT_TOKEN = 'OJZJLgvFMvMR8NFZwlR4uT8Xra9Ciys8'

console.log('SenalDB is connected')

/**
 * Upload file to GoFile and return buffer + meta
 * @param {string} filePath
 * @returns {Promise<{buffer: Buffer, mimeType: string, fileName: string}>}
 */
async function uploadAndGetBuffer(filePath) {
  try {
    if (!fs.existsSync(filePath)) throw new Error('File not found: ' + filePath)

    const fileName = path.basename(filePath)
    const mimeType = mime.lookup(fileName) || 'application/octet-stream'

    const form = new FormData()
    form.append('file', fs.createReadStream(filePath))

    const uploadRes = await axios.post(`${GOFILE_API}/uploadFile`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: ACCOUNT_TOKEN,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    })

    if (uploadRes.data.status !== 'ok') throw new Error('Upload failed')

    const directLink = uploadRes.data.data.directLink
    console.log(`✅ Uploaded: ${directLink}`)

    const fileRes = await axios.get(directLink, { responseType: 'arraybuffer' })
    console.log(`✅ Downloaded buffer for WhatsApp`)

    return {
      buffer: Buffer.from(fileRes.data),
      mimeType,
      fileName,
    }
  } catch (err) {
    console.error('❌ uploadAndGetBuffer error:', err.message)
    throw err
  }
}

/**
 * Send the file buffer to WhatsApp based on type
 * @param {object} sock - WhatsApp client
 * @param {string} jid - Chat ID (msg.key.remoteJid)
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - Detected mime
 * @param {string} fileName - Name to show
 */
async function sendFileToWhatsApp(sock, jid, buffer, mimeType, fileName) {
  try {
    let messageType = 'document' // default fallback

    if (mimeType.startsWith('audio/')) {
      messageType = 'audio'
    } else if (mimeType.startsWith('video/')) {
      messageType = 'video'
    } else if (mimeType.startsWith('image/')) {
      messageType = 'image'
    } else if (
      mimeType === 'application/vnd.android.package-archive' || // apk
      mimeType === 'application/x-msdownload' ||                 // exe
      mimeType === 'application/java-archive' ||                 // jar
      mimeType === 'application/x-iso9660-image' ||              // iso
      mimeType === 'application/pdf'
    ) {
      messageType = 'document'
    }

    const messageData = {
      [messageType]: buffer,
      mimetype: mimeType,
      fileName,
      caption: `🗂 File: ${fileName}`,
      ptt: messageType === 'audio' ? false : undefined,
    }

    await sock.sendMessage(jid, messageData)
    console.log(`✅ Sent ${messageType} to WhatsApp: ${fileName}`)
  } catch (err) {
    console.error('❌ sendFileToWhatsApp error:', err.message)
  }
}

module.exports = {
  uploadAndGetBuffer,
  sendFileToWhatsApp,
        }
