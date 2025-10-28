// ================= Required Modules =================
require("dotenv").config(); // Load .env first
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
const { Storage, File } = require("megajs");
const fs = require("fs");
const P = require("pino");
const path = require("path");
const express = require("express");
const archiver = require("archiver");
const unzipper = require("unzipper");
const config = require("./config");
const { sms } = require("./lib/msg");
const connectDB = require("./lib/mongodb");
const { readEnv } = require("./lib/database");

// ================= Bot Identity =================
const botName = "Senal MD";
const OWNER_NUMBER = process.env.OWNER_NUMBER || config.OWNER_NUMBER || "94712872326";
const PORT = process.env.PORT || 8080;

// ================= MEGA Credentials =================
const MEGA_EMAIL = process.env.MEGA_EMAIL || config.MEGA_EMAIL;
const MEGA_PASSWORD = process.env.MEGA_PASSWORD || config.MEGA_PASSWORD;
const megaSessionFile = "senal_md_session.zip";

// ================= Session Paths =================
const authPath = path.join(__dirname, "auth_info_baileys");
if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });
const sessionFile = path.join(__dirname, "session_active.json");
const sessionBackupZip = path.join(__dirname, "session_backup.zip");

// ================= FAKE REPLY CONTEXT =================
const chama = {
  key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_FAKE_ID_TS" },
  message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${botName};;;;\nFN:${botName}\nORG:Meta Platforms\nTEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
};

// ================= MEGA Session Manager =================
class MegaSessionManager {
  constructor() { this.storage = null; this.connected = false; }
  async connect() {
    if (!MEGA_EMAIL || !MEGA_PASSWORD) return false;
    if (this.connected) return true;
    try { this.storage = await new Storage({ email: MEGA_EMAIL, password: MEGA_PASSWORD }).ready; this.connected = true; return true; }
    catch (err) { console.error("❌ MEGA Error:", err.message); return false; }
  }
  async compressSession() {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(sessionBackupZip);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", () => resolve(sessionBackupZip));
      archive.on("error", reject);
      archive.pipe(output); archive.directory(authPath, false); archive.finalize();
    });
  }
  async uploadSession() {
    if (!this.connected) await this.connect();
    if (!this.connected) throw new Error("Not connected to MEGA");
    await this.compressSession();
    const existingFile = this.storage.root.children.find(f => f.name === megaSessionFile);
    if (existingFile) await existingFile.delete();
    const fileData = fs.readFileSync(sessionBackupZip);
    const uploadedFile = await this.storage.upload(megaSessionFile, fileData).complete;
    const shareLink = await uploadedFile.link();
    const sessionId = shareLink.split("/file/")[1];
    this.saveSessionId(sessionId);
    if (fs.existsSync(sessionBackupZip)) fs.unlinkSync(sessionBackupZip);
    return sessionId;
  }
  async downloadSession(sessionId = null) {
    if (!this.connected) await this.connect();
    if (sessionId) {
      const file = File.fromURL(`https://mega.nz/file/${sessionId}`);
      return new Promise((resolve, reject) => {
        file.download().pipe(fs.createWriteStream(sessionBackupZip))
          .on("finish", async () => { await this.extractSession(sessionBackupZip); fs.unlinkSync(sessionBackupZip); resolve(true); })
          .on("error", reject);
      });
    } else {
      const file = this.storage.root.children.find(f => f.name === megaSessionFile);
      if (!file) throw new Error("Session not found in MEGA");
      const data = await file.downloadBuffer();
      fs.writeFileSync(sessionBackupZip, data);
      await this.extractSession(sessionBackupZip); fs.unlinkSync(sessionBackupZip);
      return true;
    }
  }
  async extractSession(zipPath) {
    if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
    fs.mkdirSync(authPath, { recursive: true });
    return new Promise((resolve, reject) => {
      fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: authPath }))
        .on("close", () => resolve(true)).on("error", reject);
    });
  }
  saveSessionId(sessionId) {
    const envPath = path.join(__dirname, ".env");
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, "utf8");
      envContent.includes("SESSION_ID=") ? envContent = envContent.replace(/SESSION_ID=.*/g, `SESSION_ID=${sessionId}`) : envContent += `\nSESSION_ID=${sessionId}`;
      fs.writeFileSync(envPath, envContent);
    }
    fs.writeFileSync(path.join(__dirname, "mega_session.json"), JSON.stringify({ sessionId, uploadedAt: new Date().toISOString(), email: MEGA_EMAIL }, null, 2));
  }
  loadSessionId() { const cfg = path.join(__dirname, "mega_session.json"); return fs.existsSync(cfg) ? JSON.parse(fs.readFileSync(cfg, "utf8")).sessionId : null; }
  hasLocalSession() { return fs.existsSync(path.join(authPath, "creds.json")); }
  async autoSync() {
    const hasLocal = this.hasLocalSession(), savedSessionId = this.loadSessionId();
    if (!hasLocal && savedSessionId) await this.downloadSession(savedSessionId);
  }
}

const megaManager = MEGA_EMAIL && MEGA_PASSWORD ? new MegaSessionManager() : null;

// ================= Session Helpers =================
function isSessionValid() { return fs.existsSync(sessionFile) && fs.existsSync(path.join(authPath, "creds.json")); }
function markSessionActive(phone) { fs.writeFileSync(sessionFile, JSON.stringify({ active: true, phoneNumber: phone, lastConnected: new Date().toISOString() }, null, 2)); }
function clearSession() { if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true }); if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile); }

// ================= Express Server =================
const app = express();
app.get("/", (req, res) => {
  res.send(`<h1>✅ ${botName} Running</h1><p>Status: ${isSessionValid() ? "Connected ✅" : "Waiting QR 📱"}</p><p>MEGA: ${MEGA_EMAIL ? "Enabled ☁️" : "Disabled ❌"}</p>`);
});
app.listen(PORT, () => console.log(`🌐 Server running on http://localhost:${PORT}`));

// ================= Connect WhatsApp =================
let reconnectAttempts = 0, isConnecting = false;
async function connectToWA() {
  if (isConnecting) return; isConnecting = true;
  try {
    await connectDB(); const envConfig = await readEnv(); const prefix = envConfig.PREFIX || "."; const aliveImg = envConfig.ALIVE_IMG || "https://files.catbox.moe/gm88nn.png";
    if (megaManager) await megaManager.autoSync();
    const hasValidSession = isSessionValid();
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
      generateHighQualityLinkPreview: true
    });
    global.conn = conn;
    conn.ev.on("connection.update", async (u) => {
      const { connection, lastDisconnect, qr } = u;
      if (qr && !hasValidSession) console.log("📱 Scan QR with WhatsApp");
      if (connection === "close") { isConnecting = false; setTimeout(connectToWA, 5000); }
      if (connection === "open") { isConnecting = false; reconnectAttempts = 0; console.log(`✅ Connected as ${conn.user.name} (${conn.user.id.split(":")[0]})`); markSessionActive(conn.user.id.split(":")[0]); }
    });
    conn.ev.on("creds.update", saveCreds);
    conn.ev.on("messages.upsert", async (mek) => { /* Command/message handler here */ });
  } catch (err) { isConnecting = false; console.error("❌ WA Error:", err.message); setTimeout(connectToWA, 10000); }
}

// ================= Start Bot =================
console.log(`🤖 ${botName} Initializing...`);
setTimeout(connectToWA, 3000);
