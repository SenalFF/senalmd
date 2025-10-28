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
const USE_PAIRING_CODE = config.USE_PAIRING_CODE === "true" || false;
const PAIRING_NUMBER = config.PAIRING_NUMBER || "";
const MEGA_SESSION_URL = config.MEGA_SESSION_URL || process.env.MEGA_SESSION_URL || "";
const SESSION_JSON = config.SESSION_JSON || process.env.SESSION_JSON || "";

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
      // Check if it's a JSON file instead of ZIP
      try {
        const fileContent = fs.readFileSync(zipPath, 'utf8');
        
        // Try to parse as JSON first
        try {
          const jsonData = JSON.parse(fileContent);
          console.log('📄 Detected JSON credentials file');
          
          // Ensure auth folder exists
          if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
          }
          fs.mkdirSync(authPath, { recursive: true });
          
          // Write creds.json
          const credsPath = path.join(authPath, 'creds.json');
          fs.writeFileSync(credsPath, JSON.stringify(jsonData, null, 2));
          
          console.log('✅ JSON credentials extracted');
          resolve(true);
          return;
        } catch (jsonError) {
          // Not JSON, continue with ZIP extraction
          console.log('📦 Processing as ZIP file');
        }
      } catch (readError) {
        // File might be binary ZIP, continue with ZIP extraction
      }
      
      // Extract as ZIP
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
        // Download using direct link or session ID
        const { File } = require('megajs');
        let fileUrl;
        
        // Check if it's a full URL or just session ID
        if (sessionId.startsWith('http')) {
          fileUrl = sessionId;
          console.log('🔗 Using full MEGA URL');
        } else {
          fileUrl = `https://mega.nz/file/${sessionId}`;
          console.log('🔑 Using Session ID');
        }
        
        const file = File.fromURL(fileUrl);
        
        return new Promise((resolve, reject) => {
          const writeStream = fs.createWriteStream(sessionBackupZip);
          
          file.download()
            .pipe(writeStream)
            .on('finish', async () => {
              console.log('✅ Downloaded from MEGA');
              
              try {
                await this.extractSession(sessionBackupZip);
                if (fs.existsSync(sessionBackupZip)) {
                  fs.unlinkSync(sessionBackupZip);
                }
                resolve(true);
              } catch (extractError) {
                console.error('❌ Extraction failed:', extractError.message);
                if (fs.existsSync(sessionBackupZip)) {
                  fs.unlinkSync(sessionBackupZip);
                }
                reject(extractError);
              }
            })
            .on('error', (error) => {
              console.error('❌ Download stream error:', error.message);
              if (fs.existsSync(sessionBackupZip)) {
                fs.unlinkSync(sessionBackupZip);
              }
              reject(error);
            });
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
        if (fs.existsSync(sessionBackupZip)) {
          fs.unlinkSync(sessionBackupZip);
        }
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
    const megaUrl = MEGA_SESSION_URL;

    console.log('\n' + '='.repeat(60));
    console.log('🔄 MEGA AUTO-SYNC');
    console.log('='.repeat(60));

    // Priority 1: Use MEGA_SESSION_URL from env/config
    if (!hasLocal && megaUrl) {
      console.log('🔗 MEGA URL found in config');
      console.log('📥 Restoring from MEGA URL...');
      try {
        await this.downloadSession(megaUrl);
        console.log('✅ Session restored from MEGA URL!');
        return 'downloaded';
      } catch (error) {
        console.log('⚠️ MEGA URL restore failed:', error.message);
        console.log('💡 Trying other methods...');
      }
    }

    // Priority 2: Use saved Session ID
    if (!hasLocal && savedSessionId) {
      console.log('🔑 Session ID found');
      console.log('📥 Restoring from Session ID...');
      try {
        await this.downloadSession(savedSessionId);
        console.log('✅ Session restored from Session ID!');
        return 'downloaded';
      } catch (error) {
        console.log('⚠️ Session ID restore failed - will create new session');
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
function createSessionFromJSON(jsonData) {
  try {
    console.log('📝 Creating session from JSON credentials...');
    
    // Ensure auth folder exists
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }
    
    // Parse JSON if it's a string
    const credsData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    // Write creds.json
    const credsPath = path.join(authPath, 'creds.json');
    fs.writeFileSync(credsPath, JSON.stringify(credsData, null, 2));
    
    console.log('✅ Session credentials saved to auth_info_baileys/creds.json');
    return true;
  } catch (error) {
    console.error('❌ Failed to create session from JSON:', error.message);
    return false;
  }
}

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
let lastConnectionAttempt = 0;
const MIN_CONNECTION_INTERVAL = 10000; // Minimum 10 seconds between attempts

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

  // Enforce minimum interval between connection attempts
  const now = Date.now();
  const timeSinceLastAttempt = now - lastConnectionAttempt;
  if (timeSinceLastAttempt < MIN_CONNECTION_INTERVAL) {
    const waitTime = MIN_CONNECTION_INTERVAL - timeSinceLastAttempt;
    console.log(`⏳ Cooling down... waiting ${(waitTime/1000).toFixed(1)}s`);
    clearConnectionTimeout();
    connectionTimeout = setTimeout(() => connectToWA(), waitTime);
    return;
  }

  try {
    isConnecting = true;
    lastConnectionAttempt = Date.now();
    clearConnectionTimeout(); // Clear any pending reconnection
    
    console.log(`\n🔌 Connection attempt #${reconnectAttempts + 1}`);
    
    // ================= Check for SESSION_JSON =================
    if (SESSION_JSON && !isSessionValid()) {
      console.log('\n' + '='.repeat(60));
      console.log('🔑 SESSION_JSON DETECTED');
      console.log('='.repeat(60));
      
      const sessionCreated = createSessionFromJSON(SESSION_JSON);
      if (sessionCreated) {
        console.log('✅ Session created from JSON credentials');
        console.log('🔄 Proceeding to connect...');
        console.log('='.repeat(60) + '\n');
      } else {
        console.log('⚠️ Failed to create session from JSON');
        console.log('='.repeat(60) + '\n');
      }
    }
    
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
    
    // Use latest Baileys version with fallback
    let version;
    try {
      const latest = await fetchLatestBaileysVersion();
      version = latest.version;
      console.log(`📱 Using Baileys version: [${version.join('.')}]`);
    } catch (error) {
      version = [2, 3000, 1015901307]; // Fallback version
      console.log(`📱 Using fallback version: [${version.join('.')}]`);
    }

    const conn = makeWASocket({
      version,
      logger: P({ level: "silent" }),
      printQRInTerminal: !hasValidSession, // Only print QR if no session
      browser: Browsers.ubuntu("Chrome"), // Changed from macOS to Ubuntu
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" }))
      },
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false, // Disabled to reduce load
      getMessage: async () => ({ conversation: "" }),
      defaultQueryTimeoutMs: 120000, // Increased to 2 minutes
      connectTimeoutMs: 120000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 5000, // Increased delay
      maxMsgRetryCount: 2, // Reduced retry attempts
      qrTimeout: 60000, // 60 second QR timeout
      emitOwnEvents: false, // Don't emit events for own messages
      fireInitQueries: false, // Don't fire initial queries
    });

    global.conn = conn;

    // ================= Connection Handler =================
    let qrScanned = false;
    let pairingCodeRequested = false;
    
    conn.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Handle QR code or pairing code
      if (qr && !hasValidSession && !qrScanned) {
        if (USE_PAIRING_CODE && PAIRING_NUMBER && !pairingCodeRequested) {
          pairingCodeRequested = true;
          console.log("\n" + "=".repeat(50));
          console.log("📱 PAIRING CODE MODE");
          console.log("=".repeat(50));
          try {
            const code = await conn.requestPairingCode(PAIRING_NUMBER);
            console.log(`🔑 Pairing Code: ${code}`);
            console.log("📲 Enter this code in WhatsApp:");
            console.log("   Settings → Linked Devices → Link a Device");
            console.log("   → Link with phone number instead");
            console.log("=".repeat(50) + "\n");
          } catch (err) {
            console.log("❌ Pairing code failed:", err.message);
            console.log("🔄 Falling back to QR code...\n");
            displayQR(qr);
          }
        } else {
          displayQR(qr);
        }
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
          
          if (reconnectAttempts > 2) { // Reduced from 3 to 2
            console.log("🔄 Too many 405 errors - waiting 5 minutes before retry");
            console.log("💡 Possible causes:");
            console.log("   - IP rate limited by WhatsApp");
            console.log("   - Too many connection attempts");
            console.log("   - Network/firewall blocking");
            clearSession();
            reconnectAttempts = 0;
            clearConnectionTimeout();
            connectionTimeout = setTimeout(() => connectToWA(), 300000); // Wait 5 minutes
          } else {
            console.log(`⏳ Retry ${reconnectAttempts}/2 in 60 seconds...`);
            clearConnectionTimeout();
            connectionTimeout = setTimeout(() => connectToWA(), 60000); // Wait 60 seconds
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
