// ================= Required Modules =================
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers,
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const P = require("pino");
const path = require("path");
const express = require("express");
const config = require("./config");
const { sms } = require("./lib/msg");
const connectDB = require("./lib/mongodb");
const { readEnv } = require("./lib/database");

// ================= Owner =================
const ownerNumber = [config.OWNER_NUMBER || "94769872326"];

// ================= Bot Info =================
const botName = "Senal MD";
const chama = {
  key: {
    remoteJid: "status@broadcast",
    participant: "0@s.whatsapp.net",
    fromMe: false,
    id: "META_AI_FAKE_ID_TS",
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
END:VCARD`,
    },
  },
};

//=================== SESSION AUTH ============================
const authPath = path.join(__dirname, "/auth_info_baileys");
const credsFile = path.join(authPath, "creds.json");

// Ensure auth directory exists
if (!fs.existsSync(authPath)) {
  fs.mkdirSync(authPath, { recursive: true });
}

// ⚠️ FIXED: Better session handling with proper error checking
async function setupSession() {
  if (fs.existsSync(credsFile)) {
    console.log("✅ Session file already exists");
    return true;
  }

  if (!config.SESSION_ID) {
    console.log("❌ Please add your SESSION_ID in .env!");
    process.exit(1);
  }

  try {
    console.log("⏳ Downloading session file...");
    const { File } = require("megajs");
    
    // Extract only the file ID from the session string
    const sessdata = config.SESSION_ID.replace(/[^a-zA-Z0-9_-]/g, '');
    
    const file = File.fromURL(`https://mega.nz/file/${sessdata}`);
    
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(credsFile);
      
      file.download()
        .pipe(writeStream)
        .on("finish", () => {
          console.log("✅ Session downloaded successfully");
          resolve(true);
        })
        .on("error", (err) => {
          console.error("❌ Session download failed:", err.message);
          reject(err);
        });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        writeStream.close();
        reject(new Error("Session download timeout"));
      }, 30000);
    });
  } catch (err) {
    console.error("❌ Error setting up session:", err.message);
    process.exit(1);
  }
}

// ================= Express Server =================
const app = express();
const port = process.env.PORT || 8000;

app.get("/", (req, res) => res.send("Hey, Senal MD started ✅"));

app.listen(port, () => console.log(`🌐 Server listening on http://localhost:${port}`));

// ================= Connect to WhatsApp =================
async function connectToWA() {
  try {
    // ⚠️ FIXED: Ensure session is ready before connecting
    await setupSession();
    
    // ⚠️ FIXED: Add MongoDB connection error handling
    try {
      await connectDB();
    } catch (dbErr) {
      console.error("⚠️ MongoDB connection failed, continuing anyway:", dbErr.message);
    }

    const envConfig = await readEnv();
    const prefix = envConfig.PREFIX || ".";

    console.log("⏳ Connecting Senal MD BOT...");

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
      logger: P({ level: "silent" }),
      printQRInTerminal: false,
      browser: Browsers.macOS("Firefox"),
      syncFullHistory: false, // ⚠️ FIXED: Changed to false for faster connection
      auth: state,
      version,
      // ⚠️ FIXED: Added connection options
      getMessage: async (key) => {
        return { conversation: "Hello" };
      },
    });

    // ================= Connection Updates =================
    conn.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log("📱 QR Code received (but not displayed)");
      }

      if (connection === "close") {
        const shouldReconnect = 
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        console.log("❌ Connection closed due to:", 
          lastDisconnect?.error?.message || "Unknown reason");
        
        if (shouldReconnect) {
          console.log("🔄 Reconnecting in 3 seconds...");
          setTimeout(() => connectToWA(), 3000);
        } else {
          console.log("❌ Logged out from WhatsApp. Please scan QR again.");
          // ⚠️ FIXED: Delete session on logout
          if (fs.existsSync(credsFile)) {
            fs.unlinkSync(credsFile);
          }
          process.exit(0);
        }
      } else if (connection === "connecting") {
        console.log("⏳ Connecting to WhatsApp...");
      } else if (connection === "open") {
        console.log("✅ Bot connected to WhatsApp");

        // Load plugins
        const pluginsPath = path.join(__dirname, "plugins");
        if (fs.existsSync(pluginsPath)) {
          fs.readdirSync(pluginsPath).forEach((plugin) => {
            if (path.extname(plugin).toLowerCase() === ".js") {
              try {
                require("./plugins/" + plugin);
                console.log(`✅ Loaded plugin: ${plugin}`);
              } catch (err) {
                console.error(`❌ Error loading plugin ${plugin}:`, err.message);
              }
            }
          });
        }

        // Send alive message
        try {
          const upMsg = envConfig.ALIVE_MSG || `Senal MD connected ✅\nPrefix: ${prefix}`;
          const aliveImg = envConfig.ALIVE_IMG || null;
          const ownerJid = ownerNumber[0] + "@s.whatsapp.net";

          if (aliveImg) {
            await conn.sendMessage(ownerJid, {
              image: { url: aliveImg },
              caption: upMsg,
            });
          } else {
            await conn.sendMessage(ownerJid, { text: upMsg });
          }

          // Send contact
          await conn.sendMessage(ownerJid, chama.message);
        } catch (msgErr) {
          console.error("⚠️ Failed to send alive message:", msgErr.message);
        }
      }
    });

    conn.ev.on("creds.update", saveCreds);

    // ================= Handle Incoming Messages =================
    conn.ev.on("messages.upsert", async (mek) => {
      try {
        mek = mek.messages[0];
        if (!mek?.message) return;

        // Handle ephemeral messages
        mek.message =
          getContentType(mek.message) === "ephemeralMessage"
            ? mek.message.ephemeralMessage.message
            : mek.message;

        // Auto-read status updates
        if (
          mek.key &&
          mek.key.remoteJid === "status@broadcast" &&
          config.AUTO_READ_STATUS === true
        ) {
          await conn.readMessages([mek.key]);
        }

        const m = sms(conn, mek);
        const from = mek.key.remoteJid;
        const type = getContentType(mek.message);

        // Parse body
        let body = "";
        const contentType = getContentType(mek.message);

        if (contentType === "conversation") body = mek.message.conversation;
        else if (contentType === "extendedTextMessage") 
          body = mek.message.extendedTextMessage.text;
        else if (contentType === "buttonsResponseMessage") 
          body = mek.message.buttonsResponseMessage.selectedButtonId;
        else if (contentType === "listResponseMessage") 
          body = mek.message.listResponseMessage.singleSelectReply.selectedRowId;

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

        const reply = (text, extra = {}) =>
          conn.sendMessage(from, { text, ...extra }, { quoted: mek });

        // Load commands
        const events = require("./command");

        // Button handler
        if (contentType === "buttonsResponseMessage") {
          const btnId = mek.message.buttonsResponseMessage.selectedButtonId;
          for (const plugin of events.commands) {
            if (plugin.buttonHandler) {
              try {
                await plugin.buttonHandler(conn, mek, btnId);
              } catch (err) {
                console.error("Button handler error:", err);
              }
            }
          }
        }

        // Command execution
        const cmd = events.commands.find((c) => {
          if (!c.pattern) return false;
          if (c.pattern.toLowerCase() === commandText) return true;
          if (c.alias && c.alias.map((a) => a.toLowerCase()).includes(commandText)) 
            return true;
          return false;
        });

        if (cmd) {
          if (cmd.react) {
            await conn.sendMessage(from, { 
              react: { text: cmd.react, key: mek.key } 
            }).catch(() => {});
          }
          
          try {
            await cmd.function(conn, mek, m, {
              from,
              body,
              isCmd,
              command: commandText,
              args,
              q,
              isGroup,
              sender,
              senderNumber,
              botNumber2: jidNormalizedUser(conn.user.id),
              botNumber,
              pushname,
              isMe,
              isOwner,
              reply,
            });
          } catch (e) {
            console.error("[PLUGIN ERROR]", e);
            reply("⚠️ An error occurred while executing the command.");
          }
        }
      } catch (msgErr) {
        console.error("[MESSAGE HANDLER ERROR]", msgErr);
      }
    });
  } catch (err) {
    console.error("❌ Error connecting to WhatsApp:", err);
    console.log("🔄 Retrying in 10 seconds...");
    setTimeout(() => connectToWA(), 10000);
  }
}

// ⚠️ FIXED: Start bot immediately
connectToWA().catch(console.error);
