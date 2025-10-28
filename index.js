// ================= Required Modules =================
require("dotenv").config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const { Storage, File } = require('megajs');
const fs = require("fs");
const P = require("pino");
const path = require("path");
const express = require("express");
const archiver = require('archiver');
const unzipper = require('unzipper');
const config = require("./config");
const { sms } = require("./lib/msg");

// ================= Bot Identity =================
const botName = "Senal MD";
const ownerNumber = [config.OWNER_NUMBER || "94712872326"];

// ================= MEGA Credentials =================
const MEGA_EMAIL = config.MEGA_EMAIL || process.env.MEGA_EMAIL;
const MEGA_PASSWORD = config.MEGA_PASSWORD || process.env.MEGA_PASSWORD;

// ================= Session Paths =================
const authPath = path.join(__dirname, "auth_info_baileys");
const sessionFile = path.join(__dirname, "session_active.json");
const sessionBackupZip = path.join(__dirname, "session_backup.zip");
const megaSessionFile = 'senal_md_session.zip';

if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });

// ================= MEGA SESSION MANAGER =================
class MegaSessionManager {
  constructor() {
    this.storage = null;
    this.connected = false;
  }

  async connect() {
    if (this.connected) return true;
    try {
      console.log('🔐 Connecting to MEGA.nz...');
      this.storage = await new Storage({ email: MEGA_EMAIL, password: MEGA_PASSWORD }).ready;
      this.connected = true;
      console.log('✅ Connected to MEGA.nz');
      return true;
    } catch (error) {
      console.error('❌ MEGA connection failed:', error.message);
      return false;
    }
  }

  async compressSession() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(authPath)) return reject(new Error('No session folder found'));
      const output = fs.createWriteStream(sessionBackupZip);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', () => resolve(sessionBackupZip));
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(authPath, false);
      archive.finalize();
    });
  }

  async extractSession(zipPath) {
    return new Promise((resolve, reject) => {
      if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
      fs.mkdirSync(authPath, { recursive: true });
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: authPath }))
        .on('close', resolve)
        .on('error', reject);
    });
  }

  async uploadSession() {
    if (!this.connected) await this.connect();
    if (!this.connected) throw new Error('Not connected to MEGA');
    await this.compressSession();
    const existingFile = this.storage.root.children.find(f => f.name === megaSessionFile);
    if (existingFile) await existingFile.delete();
    const uploadedFile = await this.storage.upload(megaSessionFile, fs.readFileSync(sessionBackupZip)).complete;
    const shareLink = await uploadedFile.link();
    const sessionId = shareLink.split('/file/')[1];
    this.saveSessionId(sessionId);
    fs.existsSync(sessionBackupZip) && fs.unlinkSync(sessionBackupZip);
    return sessionId;
  }

  async downloadSession(sessionId = null) {
    if (sessionId) {
      const file = File.fromURL(`https://mega.nz/file/${sessionId}`);
      return new Promise((resolve, reject) => {
        file.download().pipe(fs.createWriteStream(sessionBackupZip))
          .on('finish', async () => { await this.extractSession(sessionBackupZip); fs.unlinkSync(sessionBackupZip); resolve(true); })
          .on('error', reject);
      });
    } else {
      if (!this.connected) await this.connect();
      const file = this.storage.root.children.find(f => f.name === megaSessionFile);
      if (!file) throw new Error('Session not found in MEGA');
      const data = await file.downloadBuffer();
      fs.writeFileSync(sessionBackupZip, data);
      await this.extractSession(sessionBackupZip);
      fs.unlinkSync(sessionBackupZip);
      return true;
    }
  }

  saveSessionId(sessionId) {
    fs.writeFileSync(path.join(__dirname, 'mega_session.json'), JSON.stringify({ sessionId, uploadedAt: new Date(), email: MEGA_EMAIL }, null, 2));
    console.log('✅ Session ID saved');
  }

  loadSessionId() {
    const configPath = path.join(__dirname, 'mega_session.json');
    return fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')).sessionId : null;
  }

  hasLocalSession() { return fs.existsSync(path.join(authPath, 'creds.json')); }

  async autoSync() {
    const savedSessionId = this.loadSessionId();
    if (!this.hasLocalSession() && savedSessionId) {
      console.log('📥 Restoring from MEGA...');
      await this.downloadSession(savedSessionId);
      return 'downloaded';
    } else if (this.hasLocalSession()) {
      console.log('✅ Local session exists');
      return 'local';
    } else {
      console.log('❌ No session found');
      return 'none';
    }
  }
}

let megaManager = (MEGA_EMAIL && MEGA_PASSWORD) ? new MegaSessionManager() : null;

// ================= Helper Functions =================
function isSessionValid() {
  try {
    const credsPath = path.join(authPath, "creds.json");
    if (fs.existsSync(sessionFile) && fs.existsSync(credsPath)) {
      const credsData = JSON.parse(fs.readFileSync(credsPath, "utf8"));
      return !!credsData?.me?.id;
    }
    return false;
  } catch { return false; }
}

function markSessionActive(phoneNumber) {
  fs.writeFileSync(sessionFile, JSON.stringify({ active: true, phoneNumber, createdAt: new Date(), lastConnected: new Date() }, null, 2));
}

function updateSessionTime() {
  if (fs.existsSync(sessionFile)) {
    const sessionData = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
    sessionData.lastConnected = new Date().toISOString();
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
  }
}

function clearSession() {
  fs.existsSync(authPath) && fs.rmSync(authPath, { recursive: true, force: true });
  fs.existsSync(sessionFile) && fs.unlinkSync(sessionFile);
}

// ================= Express Server =================
const app = express();
const port = process.env.PORT || 8000;
app.get("/", (req, res) => res.send(`
  <html>
    <head><title>${botName}</title></head>
    <body style="font-family: Arial; padding: 50px; text-align: center;">
      <h1>✅ ${botName} is Running!</h1>
      <p>Status: <strong>${isSessionValid() ? 'Connected ✅' : 'Waiting for QR 📱'}</strong></p>
      <p>MEGA Backup: <strong>${MEGA_EMAIL ? 'Enabled ☁️' : 'Disabled ❌'}</strong></p>
    </body>
  </html>
`));
app.listen(port, () => console.log(`🌐 Server: http://localhost:${port}`));

// ================= QR Display =================
function displayQR(qr) {
  console.log("\n" + "=".repeat(50));
  console.log("📱 SCAN THIS QR CODE WITH WHATSAPP");
  console.log(qr);
  console.log("=".repeat(50) + "\n");
}

// ================= WhatsApp Connection =================
let reconnectAttempts = 0, isConnecting = false;
async function connectToWA() {
  if (isConnecting) return console.log("⏳ Connection in progress...");
  try {
    isConnecting = true;
    const hasValidSession = isSessionValid();

    if (megaManager) {
      try { await megaManager.autoSync(); } catch (e) { console.log('⚠️ MEGA sync failed'); }
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
      version,
      logger: P({ level: "silent" }),
      printQRInTerminal: false,
      browser: Browsers.macOS("Desktop"),
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })) },
      syncFullHistory: true,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      getMessage: async () => ({ conversation: "" }),
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
    });

    global.conn = conn;
    let qrScanned = false;

    // ================= Event Handlers =================
    conn.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr && !hasValidSession && !qrScanned) displayQR(qr);

      if (connection === "close") {
        isConnecting = false;
        const code = lastDisconnect?.error?.output?.statusCode || 0;
        if ([DisconnectReason.badSession, 405].includes(code)) {
          megaManager && await megaManager.downloadSession(megaManager.loadSessionId()).catch(() => clearSession());
          clearSession();
          setTimeout(connectToWA, 3000);
        } else {
          setTimeout(connectToWA, 5000);
        }
      } else if (connection === "open") {
        isConnecting = false;
        reconnectAttempts = 0;
        qrScanned = true;
        markSessionActive(conn.user.id.split(':')[0]);
        console.log(`✅ CONNECTED: ${conn.user.id.split(':')[0]}`);
        if (megaManager && !hasValidSession) setTimeout(() => megaManager.uploadSession(), 5000);
      }
    });

    conn.ev.on("creds.update", saveCreds);

    // ================= Plugin Loader =================
    const pluginFolder = path.join(__dirname, "plugins");
    let commands = [];
    if (fs.existsSync(pluginFolder)) {
      const pluginFiles = fs.readdirSync(pluginFolder).filter(f => f.endsWith('.js'));
      for (const file of pluginFiles) {
        try { const plugin = require(path.join(pluginFolder, file)); plugin && commands.push(plugin); } 
        catch (err) { console.error(`❌ Failed plugin ${file}:`, err.message); }
      }
    }

    // ================= Message Handler =================
    conn.ev.on("messages.upsert", async (mek) => {
      mek = mek.messages[0];
      if (!mek?.message || mek.key.fromMe) return;
      mek.message = getContentType(mek.message) === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;
      const from = mek.key.remoteJid;
      const contentType = getContentType(mek.message);
      let body = (contentType === "conversation") ? mek.message.conversation
        : (contentType === "extendedTextMessage") ? mek.message.extendedTextMessage.text
        : (contentType === "imageMessage") ? mek.message.imageMessage.caption || ""
        : (contentType === "videoMessage") ? mek.message.videoMessage.caption || ""
        : (contentType === "buttonsResponseMessage") ? mek.message.buttonsResponseMessage.selectedButtonId
        : (contentType === "listResponseMessage") ? mek.message.listResponseMessage.singleSelectReply.selectedRowId
        : "";

      const isCmd = body.startsWith(".");
      const commandText = isCmd ? body.slice(1).trim().split(/ +/)[0].toLowerCase() : body.toLowerCase();
      const args = body.trim().split(/ +/).slice(isCmd ? 1 : 0);
      const q = args.join(" ");
      const sender = mek.key.fromMe ? conn.user.id.split(":")[0] + "@s.whatsapp.net" : mek.key.participant || mek.key.remoteJid;
      const senderNumber = sender.split("@")[0];
      const pushname = mek.pushName || "No Name";
      const isOwner = ownerNumber.includes(senderNumber);

      const reply = async (text, extra = {}) => await conn.sendMessage(from, { text, ...extra }, { quoted: { key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", id: "META_AI_FAKE_ID_TS" }, message: { contactMessage: { displayName: botName } } } });
      const sendMedia = async (type, media, options = {}) => {
        const mediaTypes = { image: { image: media }, video: { video: media }, audio: { audio: media, mimetype: 'audio/mp4' }, document: { document: media }, sticker: { sticker: media } };
        return await conn.sendMessage(from, { ...mediaTypes[type], ...options }, { quoted: { key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", id: "META_AI_FAKE_ID_TS" }, message: { contactMessage: { displayName: botName } } } });
      };

      if (contentType === "buttonsResponseMessage") {
        const btnId = mek.message.buttonsResponseMessage.selectedButtonId;
        for (const plugin of commands) if (plugin.buttonHandler) await plugin.buttonHandler(conn, mek, btnId, { reply, sendMedia });
      }

      const cmd = commands.find(c => c.pattern?.toLowerCase() === commandText || c.alias?.map(a => a.toLowerCase()).includes(commandText));
      if (cmd) {
        if (cmd.react) await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
        try { await cmd.function(conn, mek, { reply, sendMedia, from, args, q, sender, senderNumber, pushname, isOwner }); }
        catch (e) { console.error("[CMD ERROR]", e); await reply("⚠️ Command error occurred"); }
      }
    });

    process.on('SIGINT', async () => { console.log("⚠️ Shutting down..."); conn && await conn.end(); process.exit(0); });

  } catch (err) {
    isConnecting = false;
    console.error("❌ Error:", err.message);
    setTimeout(connectToWA, 10000);
  }
}

// ================= Start Bot =================
console.log(`\n🤖 ${botName} - WhatsApp Bot\n📦 Initializing...\n`);
setTimeout(connectToWA, 3000);
