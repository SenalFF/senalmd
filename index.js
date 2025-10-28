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
const { Storage } = require('megajs');
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

// ================= Bot Configuration =================
const prefix = config.PREFIX || ".";
const aliveImg = config.ALIVE_IMG || "https://files.catbox.moe/gm88nn.png";
const aliveMsg = config.ALIVE_MSG || "";

// ================= FAKE REPLY CONTEXT (Always Active) =================
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
if (!fs.existsSync(authPath)) {
  fs.mkdirSync(authPath, { recursive: true });
}

// ================= MEGA SESSION MANAGER (BUILT-IN) =================
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
      if (!fs.existsSync(authPath)) {
        reject(new Error('No session folder found'));
        return;
      }

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
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
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

      // Remove old session if exists
      const existingFile = this.storage.root.children.find(
        file => file.name === megaSessionFile
      );
      if (existingFile) {
        console.log('🗑️ Removing old session...');
        await existingFile.delete();
      }

      // Upload new session
      const fileData = fs.readFileSync(sessionBackupZip);
      const uploadedFile = await this.storage.upload(megaSessionFile, fileData).complete;
      const shareLink = await uploadedFile.link();
      const sessionId = shareLink.split('/file/')[1];

      console.log('✅ Session uploaded to MEGA!');
      console.log('🔎 Share Link:', shareLink);
      console.log('🔑 Session ID:', sessionId);

      // Save session ID
      this.saveSessionId(sessionId);

      // Cleanup
      if (fs.existsSync(sessionBackupZip)) {
        fs.unlinkSync(sessionBackupZip);
      }

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
        // Download using direct link
        const { File } = require('megajs');
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
        // Download from logged-in storage
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
    // Save to .env
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('SESSION_ID=')) {
        envContent = envContent.replace(/SESSION_ID=.*/g, `SESSION_ID=${sessionId}`);
      } else {
        envContent += `\nSESSION_ID=${sessionId}\n`;
      }
      fs.writeFileSync(envPath, envContent);
    }

    // Save to JSON
    const configPath = path.join(__dirname, 'mega_session.json');
    const sessionConfig = {
      sessionId: sessionId,
      uploadedAt: new Date().toISOString(),
      email: MEGA_EMAIL
    };
    fs.writeFileSync(configPath, JSON.stringify(sessionConfig, null, 2));
    console.log('✅ Session ID saved');
  }

  loadSessionId() {
    const configPath = path.join(__dirname, 'mega_session.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.sessionId;
    }
    return null;
  }

  async getMegaStatus() {
    try {
      if (!this.connected) await this.connect();
      if (!this.connected) return { success: false, error: 'Not connected' };

      const sessionId = this.loadSessionId();
      const file = this.storage.root.children.find(f => f.name === megaSessionFile);
      
      return {
        success: true,
        email: MEGA_EMAIL,
        connected: this.connected,
        hasSessionId: !!sessionId,
        sessionId: sessionId,
        hasBackup: !!file,
        backupSize: file ? `${(file.size / 1024).toFixed(2)} KB` : 'N/A',
        backupDate: file ? new Date(file.timestamp * 1000).toISOString() : 'N/A'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
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
      } catch (error) {
        console.log('⚠️ MEGA restore failed - will create new session');
        return 'none';
      }
    } else if (hasLocal) {
      console.log('✅ Local session exists');
      return 'local';
    } else {
      console.log('📱 No session found - scan QR to create new session');
      return 'none';
    }
  }
}

// Initialize MEGA manager
let megaManager = null;
let megaSetupDone = false;

if (MEGA_EMAIL && MEGA_PASSWORD) {
  megaManager = new MegaSessionManager();
}

// One-time MEGA setup check
async function checkMegaSetup() {
  if (!megaManager || megaSetupDone) return;
  
  const setupFile = path.join(__dirname, '.mega_setup_done');
  
  // Check if setup was already done
  if (fs.existsSync(setupFile)) {
    megaSetupDone = true;
    return;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🔧 MEGA FIRST-TIME SETUP CHECK');
  console.log('='.repeat(60));
  
  try {
    // Test MEGA connection
    console.log('📡 Testing MEGA connection...');
    const connected = await megaManager.connect();
    
    if (connected) {
      console.log('✅ MEGA connection successful!');
      console.log('📧 Email: ' + MEGA_EMAIL);
      
      // Check if session exists in MEGA
      const sessionId = megaManager.loadSessionId();
      if (sessionId) {
        console.log('🔑 Existing Session ID found: ' + sessionId);
        
        try {
          const file = megaManager.storage.root.children.find(
            f => f.name === megaSessionFile
          );
          if (file) {
            const fileSize = (file.size / 1024).toFixed(2);
            console.log(`✅ Session backup found in MEGA (${fileSize} KB)`);
          } else {
            console.log('⚠️ Session ID exists but file not found in MEGA');
            console.log('💡 Will create new backup after QR scan');
          }
        } catch (err) {
          console.log('⚠️ Could not verify session file');
        }
      } else {
        console.log('📱 No session ID found - first time setup');
        console.log('💡 After scanning QR, session will auto-backup to MEGA');
      }
      
      // Mark setup as done
      fs.writeFileSync(setupFile, JSON.stringify({
        setupAt: new Date().toISOString(),
        email: MEGA_EMAIL
      }));
      megaSetupDone = true;
      
      console.log('✅ MEGA setup check complete!');
      console.log('='.repeat(60) + '\n');
      
    } else {
      console.log('❌ MEGA connection failed!');
      console.log('⚠️ Check your MEGA_EMAIL and MEGA_PASSWORD in .env');
      console.log('🔄 Bot will continue without MEGA backup');
      console.log('='.repeat(60) + '\n');
    }
    
  } catch (error) {
    console.log('❌ MEGA setup error:', error.message);
    console.log('⚠️ Please verify your MEGA credentials');
    console.log('🔄 Bot will continue without MEGA backup');
    console.log('='.repeat(60) + '\n');
  }
}

// ================= Session Helper Functions =================
function isSessionValid() {
  try {
    const credsPath = path.join(authPath, "creds.json");
    if (fs.existsSync(sessionFile) && fs.existsSync(credsPath)) {
      const credsData = JSON.parse(fs.readFileSync(credsPath, "utf8"));
      if (credsData?.me?.id) {
        console.log(`✅ Valid session: ${credsData.me.id.split(':')[0]}`);
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

function markSessionActive(phoneNumber) {
  const sessionData = {
    active: true,
    phoneNumber: phoneNumber,
    createdAt: new Date().toISOString(),
    lastConnected: new Date().toISOString()
  };
  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
}

function updateSessionTime() {
  try {
    if (fs.existsSync(sessionFile)) {
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
      sessionData.lastConnected = new Date().toISOString();
      fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
    }
  } catch (error) {}
}

function clearSession() {
  try {
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log("🗑️ Cleared session folder");
    }
    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
    }
  } catch (error) {}
}

// ================= Express Server =================
const app = express();
const port = process.env.PORT || 8000;

app.get("/", (req, res) => {
  const megaStatus = megaSetupDone ? '✅ Connected' : (MEGA_EMAIL ? '⏳ Checking...' : '❌ Not configured');
  res.send(`
    <html>
      <head><title>Senal MD Bot</title></head>
      <body style="font-family: Arial; padding: 50px; text-align: center;">
        <h1>✅ ${botName} is Running!</h1>
        <p>Status: <strong>${isSessionValid() ? 'Connected ✅' : 'Waiting for QR 📱'}</strong></p>
        <p>MEGA Backup: <strong>${megaStatus}</strong></p>
        ${MEGA_EMAIL ? `<p>MEGA Email: <strong>${MEGA_EMAIL}</strong></p>` : ''}
        <hr>
        <p><a href="/mega-status">Check MEGA Status</a></p>
      </body>
    </html>
  `);
});

app.get("/mega-status", async (req, res) => {
  if (!megaManager) {
    res.send(`
      <html>
        <head><title>MEGA Status</title></head>
        <body style="font-family: Arial; padding: 50px;">
          <h2>❌ MEGA Not Configured</h2>
          <p>Add MEGA_EMAIL and MEGA_PASSWORD to .env file</p>
          <a href="/">← Back</a>
        </body>
      </html>
    `);
    return;
  }

  try {
    const status = await megaManager.getMegaStatus();
    
    res.send(`
      <html>
        <head><title>MEGA Status</title></head>
        <body style="font-family: Arial; padding: 50px;">
          <h2>☁️ MEGA Status</h2>
          ${status.success ? `
            <p>✅ <strong>Connected</strong></p>
            <p>📧 Email: <strong>${status.email}</strong></p>
            <p>🔑 Session ID: <strong>${status.hasSessionId ? '✅ Exists' : '❌ None'}</strong></p>
            ${status.hasSessionId ? `<p>ID: <code>${status.sessionId}</code></p>` : ''}
            <p>💾 Backup File: <strong>${status.hasBackup ? '✅ Found' : '❌ Not Found'}</strong></p>
            ${status.hasBackup ? `
              <p>📦 Size: <strong>${status.backupSize}</strong></p>
              <p>📅 Date: <strong>${new Date(status.backupDate).toLocaleString()}</strong></p>
            ` : ''}
          ` : `
            <p>❌ <strong>Error:</strong> ${status.error}</p>
          `}
          <hr>
          <a href="/">← Back</a>
        </body>
      </html>
    `);
  } catch (error) {
    res.send(`
      <html>
        <head><title>MEGA Status</title></head>
        <body style="font-family: Arial; padding: 50px;">
          <h2>❌ Error</h2>
          <p>${error.message}</p>
          <a href="/">← Back</a>
        </body>
      </html>
    `);
  }
});

app.listen(port, () =>
  console.log(`🌐 Server: http://localhost:${port}`)
);

// ================= QR Display =================
function displayQR(qr) {
  console.log("\n" + "=".repeat(50));
  console.log("📱 SCAN THIS QR CODE WITH WHATSAPP");
  console.log("=".repeat(50));
  console.log("\n" + qr + "\n");
  console.log("=".repeat(50));
  console.log("⏰ Scan within 20 seconds!");
  console.log("📲 WhatsApp → Linked Devices → Link a Device");
  console.log("=".repeat(50) + "\n");
}

// ================= Connection Tracking =================
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let isConnecting = false;
let connectionTimeout = null;

// Clear any pending connection timeout
function clearConnectionTimeout() {
  if (connectionTimeout) {
    clearTimeout(connectionTimeout);
    connectionTimeout = null;
  }
}

// ================= Connect to WhatsApp =================
async function connectToWA() {
  if (isConnecting) {
    console.log("⏳ Connection already in progress, skipping...");
    return;
  }

  try {
    isConnecting = true;
    clearConnectionTimeout(); // Clear any pending reconnection
    
    // ================= MEGA AUTO-SYNC =================
    if (megaManager) {
      try {
        await megaManager.autoSync();
      } catch (error) {
        console.log('⚠️ MEGA sync failed:', error.message);
      }
    } else {
      console.log('💡 Add MEGA_EMAIL & MEGA_PASSWORD to .env for auto-backup');
    }
    
    const hasValidSession = isSessionValid();
    
    if (hasValidSession) {
      console.log("🔄 Restoring session...");
    } else {
      console.log("📱 Preparing QR code...");
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
      version,
      logger: P({ level: "silent" }),
      printQRInTerminal: false,
      browser: Browsers.macOS("Desktop"),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" }))
      },
      syncFullHistory: false, // Changed to false to reduce load
      markOnlineOnConnect: false, // Changed to false initially
      generateHighQualityLinkPreview: true,
      getMessage: async () => ({ conversation: "" }),
      defaultQueryTimeoutMs: 90000, // Increased timeout
      connectTimeoutMs: 90000, // Increased timeout
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 2000, // Add delay between retries
      maxMsgRetryCount: 3, // Limit retry attempts
    });

    global.conn = conn;

    // ================= Connection Handler =================
    let qrScanned = false;
    
    conn.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr && !hasValidSession && !qrScanned) {
        displayQR(qr);
      }
      
      if (connection === "close") {
        isConnecting = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || "Unknown";
        
        console.log(`\n❌ Disconnected: ${statusCode} - ${reason}`);
        
        // ================= Handle Errors with MEGA Restore =================
        if (statusCode === DisconnectReason.badSession) {
          console.log("⚠️ Bad session detected");
          
          if (megaManager && megaManager.loadSessionId()) {
            try {
              console.log("🔄 Restoring from MEGA...");
              await megaManager.downloadSession(megaManager.loadSessionId());
              console.log("✅ Restored from MEGA!");
              reconnectAttempts = 0;
              clearConnectionTimeout();
              connectionTimeout = setTimeout(() => connectToWA(), 3000);
              return;
            } catch (error) {
              console.log("⚠️ MEGA restore failed - clearing session");
            }
          }
          
          clearSession();
          reconnectAttempts = 0;
          clearConnectionTimeout();
          connectionTimeout = setTimeout(() => connectToWA(), 3000);
          
        } else if (statusCode === 405) {
          console.log("⚠️ 405 Error - Connection rate limited or network issue");
          reconnectAttempts++;
          
          if (reconnectAttempts > 3) {
            console.log("🔄 Too many 405 errors - clearing session and waiting longer");
            clearSession();
            reconnectAttempts = 0;
            clearConnectionTimeout();
            connectionTimeout = setTimeout(() => connectToWA(), 60000); // Wait 1 minute
          } else {
            console.log(`⏳ Retry ${reconnectAttempts}/3 in 30 seconds...`);
            clearConnectionTimeout();
            connectionTimeout = setTimeout(() => connectToWA(), 30000); // Wait 30 seconds
          }
          
        } else if (statusCode === DisconnectReason.connectionClosed) {
          reconnectAttempts++;
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            clearConnectionTimeout();
            connectionTimeout = setTimeout(() => connectToWA(), 5000);
          } else {
            clearSession();
            reconnectAttempts = 0;
            clearConnectionTimeout();
            connectionTimeout = setTimeout(() => connectToWA(), 10000);
          }
          
        } else if (statusCode === DisconnectReason.loggedOut) {
          console.log("❌ Logged out. Clearing session...");
          clearSession();
          clearConnectionTimeout();
          connectionTimeout = setTimeout(() => connectToWA(), 5000);
          
        } else if (statusCode === DisconnectReason.restartRequired) {
          clearConnectionTimeout();
          connectionTimeout = setTimeout(() => connectToWA(), 2000);
          
        } else {
          clearConnectionTimeout();
          connectionTimeout = setTimeout(() => connectToWA(), 10000);
        }
        
      } else if (connection === "connecting") {
        console.log("⏳ Connecting...");
        
      } else if (connection === "open") {
        isConnecting = false;
        reconnectAttempts = 0;
        qrScanned = true;
        
        console.log("\n" + "=".repeat(50));
        console.log("✅ CONNECTED TO WHATSAPP!");
        console.log("=".repeat(50));
        console.log(`📱 Account: ${conn.user.name || "Unknown"}`);
        console.log(`📞 Number: ${conn.user.id.split(':')[0]}`);
        console.log(`⚡ Prefix: ${prefix}`);
        console.log("=".repeat(50) + "\n");
        
        markSessionActive(conn.user.id.split(':')[0]);
        
        // ================= UPLOAD TO MEGA (New Session Only) =================
        if (megaManager && !hasValidSession) {
          console.log('📤 Backing up to MEGA...');
          setTimeout(async () => {
            try {
              await megaManager.uploadSession();
              console.log('✅ Backed up to MEGA!');
            } catch (error) {
              console.error('⚠️ Backup failed:', error.message);
            }
          }, 5000);
        }
        
        setInterval(() => updateSessionTime(), 60000);

        // Load plugins
        const pluginFolder = path.join(__dirname, "plugins");
        if (fs.existsSync(pluginFolder)) {
          const plugins = fs.readdirSync(pluginFolder).filter(f => f.endsWith('.js'));
          plugins.forEach(plugin => {
            try {
              require(path.join(pluginFolder, plugin));
              console.log(`✅ ${plugin}`);
            } catch (err) {
              console.error(`❌ ${plugin}:`, err.message);
            }
          });
          console.log(`\n🔌 Loaded: ${plugins.length} plugins\n`);
        }

        // Send alive message
        const upMsg = aliveMsg || 
          `✅ *${botName} Connected!*\n\n` +
          `📱 ${conn.user.id.split(':')[0]}\n` +
          `⚡ Prefix: ${prefix}\n` +
          `⏰ ${new Date().toLocaleString()}\n` +
          `💾 Session: ${hasValidSession ? 'Restored' : 'New'}\n\n` +
          `_Ready for commands!_`;
        
        try {
          await conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
            image: { url: aliveImg },
            caption: upMsg
          }, { quoted: chama });
          console.log("✅ Alive message sent\n");
        } catch (err) {
          console.error("⚠️ Alive message failed:", err.message);
        }
      }
    });

    conn.ev.on("creds.update", saveCreds);

    // ================= Message Handler =================
    conn.ev.on("messages.upsert", async (mek) => {
      mek = mek.messages[0];
      if (!mek?.message || mek.key.fromMe) return;

      mek.message =
        getContentType(mek.message) === "ephemeralMessage"
          ? mek.message.ephemeralMessage.message
          : mek.message;

      // Auto read status
      if (mek.key?.remoteJid === "status@broadcast" && config.AUTO_READ_STATUS === "true") {
        await conn.readMessages([mek.key]);
      }

      const m = sms(conn, mek);
      const from = mek.key.remoteJid;
      const contentType = getContentType(mek.message);

      // Parse message body
      let body = "";
      if (contentType === "conversation") {
        body = mek.message.conversation;
      } else if (contentType === "extendedTextMessage") {
        body = mek.message.extendedTextMessage.text;
      } else if (contentType === "imageMessage") {
        body = mek.message.imageMessage.caption || "";
      } else if (contentType === "videoMessage") {
        body = mek.message.videoMessage.caption || "";
      } else if (contentType === "buttonsResponseMessage") {
        body = mek.message.buttonsResponseMessage.selectedButtonId;
      } else if (contentType === "listResponseMessage") {
        body = mek.message.listResponseMessage.singleSelectReply.selectedRowId;
      }

      const isCmd = body.startsWith(prefix);
      const commandText = isCmd
        ? body.slice(prefix.length).trim().split(/ +/)[0].toLowerCase()
        : body.toLowerCase();

      const args = body.trim().split(/ +/).slice(isCmd ? 1 : 0);
      const q = args.join(" ");
      const isGroup = from.endsWith("@g.us");
      const sender = mek.key.fromMe
        ? conn.user.id.split(":")[0] + "@s.whatsapp.net"
        : mek.key.participant || mek.key.remoteJid;
      const senderNumber = sender.split("@")[0];
      const botNumber = conn.user.id.split(":")[0];
      const pushname = mek.pushName || "No Name";
      const isMe = botNumber.includes(senderNumber);
      const isOwner = ownerNumber.includes(senderNumber) || isMe;

      // Reply with fake context
      const reply = async (text, extra = {}) => {
        return await conn.sendMessage(from, { text, ...extra }, { quoted: chama });
      };

      // Send media with fake context
      const sendMedia = async (type, media, options = {}) => {
        const mediaTypes = {
          image: { image: media },
          video: { video: media },
          audio: { audio: media, mimetype: 'audio/mp4' },
          document: { document: media },
          sticker: { sticker: media }
        };
        return await conn.sendMessage(from, { ...mediaTypes[type], ...options }, { quoted: chama });
      };

      // Load commands
      const events = require("./command");

      // Button handler
      if (contentType === "buttonsResponseMessage") {
        const btnId = mek.message.buttonsResponseMessage.selectedButtonId;
        for (const plugin of events.commands) {
          if (plugin.buttonHandler) {
            try {
              await plugin.buttonHandler(conn, mek, btnId, { reply, sendMedia, chama });
            } catch (err) {
              console.error("Button error:", err);
            }
          }
        }
      }

      // Command execution
      const cmd = events.commands.find((c) => {
        if (!c.pattern) return false;
        if (c.pattern.toLowerCase() === commandText) return true;
        if (c.alias?.map(a => a.toLowerCase()).includes(commandText)) return true;
        return false;
      });

      if (cmd) {
        if (cmd.react) {
          await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
        }
        try {
          await cmd.function(conn, mek, m, {
            from, body, isCmd, command: commandText, args, q, isGroup,
            sender, senderNumber, botNumber2: jidNormalizedUser(conn.user.id),
            botNumber, pushname, isMe, isOwner, reply, sendMedia, chama,
          });
        } catch (e) {
          console.error("[CMD ERROR]", e);
          await reply("⚠️ Command error occurred");
        }
      }
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log("\n⚠️ Shutting down...");
      if (conn) await conn.end();
      process.exit(0);
    });

  } catch (err) {
    isConnecting = false;
    console.error("❌ Error:", err.message);
    clearConnectionTimeout();
    connectionTimeout = setTimeout(() => connectToWA(), 10000);
  }
}

// ================= Start Bot =================
console.log("\n" + "=".repeat(60));
console.log(`🤖 ${botName} - WhatsApp Bot`);
console.log("=".repeat(60));
console.log("📦 Initializing...\n");

// Run one-time MEGA setup check, then start bot
(async () => {
  await checkMegaSetup();
  setTimeout(() => connectToWA(), 3000);
})();
