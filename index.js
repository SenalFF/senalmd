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

// ================= MEGA Credentials =================
const MEGA_EMAIL = config.MEGA_EMAIL || process.env.MEGA_EMAIL;
const MEGA_PASSWORD = config.MEGA_PASSWORD || process.env.MEGA_PASSWORD;

// ================= FAKE REPLY CONTEXT =================
const chama = {
  key: {
    remoteJid: "status@broadcast",
    participant: "0@s.whatsapp.net",
    fromMe: false,
    id: "META_AI_FAKE_ID_TS"
  },
  message: {
    contactMessage: {
      displayName: botName,
      vcard: `BEGIN:VCARD
VERSION:3.0
N:${botName};;;;
FN:${botName}
ORG:Meta Platforms
TEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002
END:VCARD`
    }
  }
};

// ================= Owner =================
const ownerNumber = [config.OWNER_NUMBER || "94712872326"];

// ================= Session Paths =================
const authPath = path.join(__dirname, "auth_info_baileys");
const sessionFile = path.join(__dirname, "session_active.json");
const sessionBackupZip = path.join(__dirname, "session_backup.zip");
const megaSessionFile = 'senal_md_session.zip';

// Create auth folder if not exists
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
      this.storage = await new Storage({
        email: MEGA_EMAIL,
        password: MEGA_PASSWORD
      }).ready;
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
      output.on('close', () => {
        console.log(`✅ Compressed: ${(archive.pointer() / 1024).toFixed(2)} KB`);
        resolve(sessionBackupZip);
      });
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
        .on('close', () => {
          console.log('✅ Session extracted');
          resolve(true);
        })
        .on('error', reject);
    });
  }

  async uploadSession() {
    try {
      if (!this.connected) await this.connect();
      if (!this.connected) throw new Error('Not connected to MEGA');
      console.log('📤 Uploading session to MEGA...');
      await this.compressSession();

      const existingFile = this.storage.root.children.find(file => file.name === megaSessionFile);
      if (existingFile) {
        console.log('🗑️  Removing old session...');
        await existingFile.delete();
      }

      const fileData = fs.readFileSync(sessionBackupZip);
      const uploadedFile = await this.storage.upload(megaSessionFile, fileData).complete;
      const shareLink = await uploadedFile.link();
      const sessionId = shareLink.split('/file/')[1];
      console.log('✅ Session uploaded to MEGA!');
      console.log('📎 Share Link:', shareLink);
      console.log('🔑 Session ID:', sessionId);
      this.saveSessionId(sessionId);

      if (fs.existsSync(sessionBackupZip)) fs.unlinkSync(sessionBackupZip);
      return sessionId;
    } catch (error) {
      console.error('❌ Upload failed:', error.message);
      throw error;
    }
  }

  async downloadSession(sessionId = null) {
    try {
      console.log('📥 Downloading session from MEGA...');
      if (sessionId) {
        const file = File.fromURL(`https://mega.nz/file/${sessionId}`);
        return new Promise((resolve, reject) => {
          file.download()
            .pipe(fs.createWriteStream(sessionBackupZip))
            .on('finish', async () => {
              console.log('✅ Downloaded from MEGA');
              await this.extractSession(sessionBackupZip);
              fs.unlinkSync(sessionBackupZip);
              resolve(true);
            })
            .on('error', reject);
        });
      } else {
        if (!this.connected) await this.connect();
        if (!this.connected) throw new Error('Not connected to MEGA');
        const file = this.storage.root.children.find(f => f.name === megaSessionFile);
        if (!file) throw new Error('Session not found in MEGA');
        const data = await file.downloadBuffer();
        fs.writeFileSync(sessionBackupZip, data);
        await this.extractSession(sessionBackupZip);
        fs.unlinkSync(sessionBackupZip);
        return true;
      }
    } catch (error) {
      console.error('❌ Download failed:', error.message);
      throw error;
    }
  }

  saveSessionId(sessionId) {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('SESSION_ID=')) {
        envContent = envContent.replace(/SESSION_ID=.*/g, `SESSION_ID=${sessionId}`);
      } else envContent += `\nSESSION_ID=${sessionId}\n`;
      fs.writeFileSync(envPath, envContent);
    }

    const configPath = path.join(__dirname, 'mega_session.json');
    const sessionConfig = { sessionId, uploadedAt: new Date().toISOString(), email: MEGA_EMAIL };
    fs.writeFileSync(configPath, JSON.stringify(sessionConfig, null, 2));
    console.log('✅ Session ID saved');
  }

  loadSessionId() {
    const configPath = path.join(__dirname, 'mega_session.json');
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf8')).sessionId;
    return null;
  }

  hasLocalSession() {
    return fs.existsSync(path.join(authPath, 'creds.json'));
  }

  async autoSync() {
    const hasLocal = this.hasLocalSession();
    const savedSessionId = this.loadSessionId();
    console.log('\n' + '='.repeat(60));
    console.log('🔄 MEGA AUTO-SYNC');
    console.log('='.repeat(60));
    if (!hasLocal && savedSessionId) {
      console.log('📥 Restoring from MEGA...');
      try {
        await this.downloadSession(savedSessionId);
        return 'downloaded';
      } catch (err) {
        console.log('⚠️ MEGA restore failed:', err.message);
        return 'none';
      }
    } else if (hasLocal) return 'local';
    else return 'none';
  }
}

// Initialize MEGA manager
let megaManager = null;
if (MEGA_EMAIL && MEGA_PASSWORD) megaManager = new MegaSessionManager();

// ================= Session Helpers =================
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
  const sessionData = { active: true, phoneNumber, createdAt: new Date().toISOString(), lastConnected: new Date().toISOString() };
  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
}

function updateSessionTime() {
  if (fs.existsSync(sessionFile)) {
    const sessionData = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
    sessionData.lastConnected = new Date().toISOString();
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
  }
}

function clearSession() {
  if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
  if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
  console.log("🗑️ Cleared session folder");
}

// ================= Express Server =================
const app = express();
const port = process.env.PORT || 8080;
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><title>Senal MD Bot</title></head>
      <body style="font-family: Arial; padding: 50px; text-align: center;">
        <h1>✅ ${botName} is Running!</h1>
        <p>Status: <strong>${isSessionValid() ? 'Connected ✅' : 'Waiting for QR 📱'}</strong></p>
        <p>MEGA Backup: <strong>${MEGA_EMAIL ? 'Enabled ☁️' : 'Disabled ❌'}</strong></p>
      </body>
    </html>
  `);
});
app.listen(port, () => console.log(`🌐 Server: http://localhost:${port}`));

// ================= QR Display =================
function displayQR(qr) {
  console.log("\n" + "=".repeat(50));
  console.log("📱 SCAN THIS QR CODE WITH WHATSAPP");
  console.log("=".repeat(50));
  console.log("\n" + qr + "\n");
  console.log("⏰ Scan within 20 seconds!");
  console.log("📲 WhatsApp → Linked Devices → Link a Device");
  console.log("=".repeat(50) + "\n");
}

// ================= Connect to WhatsApp =================
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let isConnecting = false;

async function connectToWA() {
  if (isConnecting) return console.log("⏳ Connection in progress...");
  try {
    isConnecting = true;
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    let syncStatus = 'none';
    if (megaManager) syncStatus = await megaManager.autoSync();

    const hasValidSession = isSessionValid() || syncStatus === 'downloaded';
    if (!hasValidSession) console.log('📱 No session found, QR scan required');

    const conn = makeWASocket({
      version,
      logger: P({ level: "silent" }),
      printQRInTerminal: false,
      browser: Browsers.macOS("Desktop"),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" }))
      },
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

    conn.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !hasValidSession && !qrScanned) displayQR(qr);

      if (connection === "close") {
        isConnecting = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        if ([DisconnectReason.badSession, 405].includes(statusCode)) {
          console.log("⚠️ Session issue detected");
          if (megaManager) {
            try {
              await megaManager.downloadSession(megaManager.loadSessionId());
              console.log("✅ Restored from MEGA!");
              reconnectAttempts = 0;
              setTimeout(() => connectToWA(), 3000);
              return;
            } catch { clearSession(); }
          }
          clearSession();
          reconnectAttempts = 0;
          setTimeout(() => connectToWA(), statusCode === 405 ? 30000 : 3000);

        } else if (statusCode === DisconnectReason.connectionClosed) {
          reconnectAttempts++;
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) setTimeout(() => connectToWA(), 5000);
          else { clearSession(); reconnectAttempts = 0; setTimeout(() => connectToWA(), 10000); }

        } else if (statusCode === DisconnectReason.loggedOut) {
          console.log("❌ Logged out. Clearing session...");
          clearSession();
          setTimeout(() => connectToWA(), 5000);

        } else if (statusCode === DisconnectReason.restartRequired) setTimeout(() => connectToWA(), 2000);
        else setTimeout(() => connectToWA(), 10000);

      } else if (connection === "connecting") console.log("⏳ Connecting...");

      else if (connection === "open") {
        isConnecting = false;
        reconnectAttempts = 0;
        qrScanned = true;

        console.log("\n" + "=".repeat(50));
        console.log("✅ CONNECTED TO WHATSAPP!");
        console.log("=".repeat(50));
        console.log(`📱 Account: ${conn.user.name || "Unknown"}`);
        console.log(`📞 Number: ${conn.user.id.split(':')[0]}`);
        console.log("=".repeat(50) + "\n");

        markSessionActive(conn.user.id.split(':')[0]);

        if (megaManager && !hasValidSession) {
          console.log('📤 Backing up new session to MEGA...');
          setTimeout(async () => { try { await megaManager.uploadSession(); } catch {} }, 5000);
        }

        setInterval(() => updateSessionTime(), 60000);
      }
    });

    conn.ev.on("creds.update", saveCreds);

  } catch (err) {
    isConnecting = false;
    console.error("❌ Error:", err.message);
    setTimeout(() => connectToWA(), 10000);
  }
}

// ================= Start Bot =================
console.log("\n" + "=".repeat(60));
console.log(`🤖 ${botName} - WhatsApp Bot`);
console.log("=".repeat(60));
console.log("📦 Initializing...\n");
setTimeout(() => connectToWA(), 3000);
