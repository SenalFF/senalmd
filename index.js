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
const connectDB = require("./lib/mongodb");
const { readEnv } = require("./lib/database");

// ================= Bot Identity =================
const botName = "Senal MD";

// ================= MEGA Credentials =================
const MEGA_EMAIL = config.MEGA_EMAIL || process.env.MEGA_EMAIL;
const MEGA_PASSWORD = config.MEGA_PASSWORD || process.env.MEGA_PASSWORD;

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
        console.log('🗑️  Removing old session...');
        await existingFile.delete();
      }

      // Upload new session
      const fileData = fs.readFileSync(sessionBackupZip);
      const uploadedFile = await this.storage.upload(megaSessionFile, fileData).complete;
      const shareLink = await uploadedFile.link();
      const sessionId = shareLink.split('/file/')[1];

      console.log('✅ Session uploaded to MEGA!');
      console.log('📎 Share Link:', shareLink);
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
      await this.downloadSession(savedSessionId);
      return 'downloaded';
    } else if (hasLocal) {
      console.log('✅ Local session exists');
      return 'local';
    } else {
      console.log('❌ No session found');
      return 'none';
    }
  }
}

// Initialize MEGA manager
let megaManager = null;
if (MEGA_EMAIL && MEGA_PASSWORD) {
  megaManager = new MegaSessionManager();
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

// ================= Connect to WhatsApp =================
async function connectToWA() {
  if (isConnecting) {
    console.log("⏳ Connection in progress...");
    return;
  }

  try {
    isConnecting = true;
    await connectDB();
    const envConfig = await readEnv();
    const prefix = envConfig.PREFIX || ".";
    const aliveImg = envConfig.ALIVE_IMG || "https://files.catbox.moe/gm88nn.png";
    
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
      syncFullHistory: true,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      getMessage: async () => ({ conversation: "" }),
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
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
        if (statusCode === DisconnectReason.badSession || statusCode === 405) {
          console.log("⚠️ Session issue detected");
          
          if (megaManager) {
            try {
              console.log("🔄 Restoring from MEGA...");
              await megaManager.downloadSession(megaManager.loadSessionId());
              console.log("✅ Restored from MEGA!");
              reconnectAttempts = 0;
              setTimeout(() => connectToWA(), 3000);
              return;
            } catch (error) {
              console.log("⚠️ MEGA restore failed");
            }
          }
          
          clearSession();
          reconnectAttempts = 0;
          setTimeout(() => connectToWA(), statusCode === 405 ? 30000 : 3000);
          
        } else if (statusCode === DisconnectReason.connectionClosed) {
          reconnectAttempts++;
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            setTimeout(() => connectToWA(), 5000);
          } else {
            clearSession();
            reconnectAttempts = 0;
            setTimeout(() => connectToWA(), 10000);
          }
          
        } else if (statusCode === DisconnectReason.loggedOut) {
          console.log("❌ Logged out. Clearing session...");
          clearSession();
          setTimeout(() => connectToWA(), 5000);
          
        } else if (statusCode === DisconnectReason.restartRequired) {
          setTimeout(() => connectToWA(), 2000);
          
        } else {
          setTimeout(() => connectToWA(), 10000);
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
        const upMsg = envConfig.ALIVE_MSG || 
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
    setTimeout(() => connectToWA(), 10000);
  }
}

// ================= Start Bot =================
console.log("\n" + "=".repeat(60));
console.log(`🤖 ${botName} - WhatsApp Bot`);
console.log("=".repeat(60));
console.log("📦 Initializing...\n");

setTimeout(() => connectToWA(), 3000);
