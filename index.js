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

// ================= Bot Identity =================
const botName = "Senal MD";

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

//=================== SESSION AUTH ============================
const authPath = __dirname + "/auth_info_baileys";
const credsFile = authPath + "/creds.json";

// Function to clear session
function clearSession() {
  console.log("🗑️ Clearing old session...");
  if (fs.existsSync(authPath)) {
    fs.rmSync(authPath, { recursive: true, force: true });
  }
  fs.mkdirSync(authPath, { recursive: true });
}

// Function to download session from MEGA
async function downloadSession() {
  return new Promise((resolve, reject) => {
    try {
      if (!config.SESSION_ID) {
        console.log("⚠️ No SESSION_ID found. Will generate QR code...");
        resolve(false);
        return;
      }

      console.log("📥 Downloading session from MEGA...");
      const { File } = require("megajs");
      const sessdata = config.SESSION_ID;
      const file = File.fromURL(`https://mega.nz/file/${sessdata}`);
      
      file.download()
        .pipe(fs.createWriteStream(credsFile))
        .on("finish", () => {
          console.log("✅ Session downloaded successfully");
          resolve(true);
        })
        .on("error", (err) => {
          console.error("❌ Failed to download session:", err.message);
          resolve(false);
        });
    } catch (err) {
      console.error("❌ Error in downloadSession:", err.message);
      resolve(false);
    }
  });
}

// Check and setup session
async function setupSession() {
  if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true });
  }

  if (!fs.existsSync(credsFile)) {
    await downloadSession();
  }
}

// ================= Express Server =================
const app = express();
const port = process.env.PORT || 8000;

app.get("/", (req, res) => {
  res.send("Hey, Senal MD started ✅");
});

app.listen(port, () =>
  console.log(`🌐 Server listening on http://localhost:${port}`)
);

// ================= Connect to WhatsApp =================
async function connectToWA() {
  try {
    await connectDB();
    const envConfig = await readEnv();
    const prefix = envConfig.PREFIX || ".";
    const aliveImg = envConfig.ALIVE_IMG || "https://files.catbox.moe/gm88nn.png";
    
    console.log("⏳ Connecting Senal MD BOT...");

    await setupSession();

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
      logger: P({ level: "silent" }),
      printQRInTerminal: true, // ✅ Enable QR code in terminal
      browser: Browsers.macOS("Firefox"),
      syncFullHistory: true,
      auth: state,
      version,
    });

    // ================= Connection Updates =================
    conn.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // ✅ Display QR Code
      if (qr) {
        console.log("📱 QR Code Generated! Scan it with WhatsApp:");
        console.log("Go to: WhatsApp > Linked Devices > Link a Device");
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = Object.keys(DisconnectReason).find(
          key => DisconnectReason[key] === statusCode
        );

        console.log(`❌ Connection closed. Reason: ${reason || 'Unknown'}`);

        if (statusCode === DisconnectReason.loggedOut) {
          console.log("🔴 Logged out! Clearing session and generating new QR...");
          clearSession();
          setTimeout(() => connectToWA(), 3000);
        } else if (statusCode === DisconnectReason.restartRequired) {
          console.log("🔄 Restart required...");
          connectToWA();
        } else if (statusCode === DisconnectReason.timedOut) {
          console.log("⏱️ Connection timed out, reconnecting...");
          connectToWA();
        } else if (statusCode === DisconnectReason.badSession) {
          console.log("🔴 Bad session! Clearing and reconnecting...");
          clearSession();
          setTimeout(() => connectToWA(), 3000);
        } else {
          console.log("🔄 Reconnecting...");
          setTimeout(() => connectToWA(), 5000);
        }
      } else if (connection === "open") {
        console.log("✅ Senal MD connected to WhatsApp");

        // Load plugins
        fs.readdirSync("./plugins/").forEach((plugin) => {
          if (path.extname(plugin).toLowerCase() === ".js") {
            try {
              require("./plugins/" + plugin);
            } catch (err) {
              console.error(`❌ Error loading plugin ${plugin}:`, err);
            }
          }
        });
        console.log("✅ Plugins loaded");

        // Send alive message to owner
        const upMsg = envConfig.ALIVE_MSG || `Senal MD connected ✅\nPrefix: ${prefix}`;
        try {
          await conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
            image: { url: aliveImg },
            caption: upMsg
          }, { quoted: chama });
        } catch (err) {
          console.log("⚠️ Could not send alive message:", err.message);
        }
      }
    });

    conn.ev.on("creds.update", saveCreds);

    // ================= Handle Incoming Messages =================
    conn.ev.on("messages.upsert", async (mek) => {
      mek = mek.messages[0];
      if (!mek?.message) return;

      mek.message =
        getContentType(mek.message) === "ephemeralMessage"
          ? mek.message.ephemeralMessage.message
          : mek.message;

      if (
        mek.key &&
        mek.key.remoteJid === "status@broadcast" &&
        config.AUTO_READ_STATUS === "true"
      ) {
        await conn.readMessages([mek.key]);
      }

      const m = sms(conn, mek);
      const from = mek.key.remoteJid;
      const type = getContentType(mek.message);

      // ================= Parse Body =================
      let body = "";
      const contentType = getContentType(mek.message);

      if (contentType === "conversation") {
        body = mek.message.conversation;
      } else if (contentType === "extendedTextMessage") {
        body = mek.message.extendedTextMessage.text;
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

      const reply = (text, extra = {}) =>
        conn.sendMessage(from, { text, ...extra }, { quoted: chama });

      // ✅ Send with fake reply support
      const send = (content) => conn.sendMessage(from, content, { quoted: chama });

      // ===== Load commands =====
      const events = require("./command");

      // ===== BUTTON HANDLER =====
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

      // ===== COMMAND EXECUTION =====
      const cmd = events.commands.find((c) => {
        if (!c.pattern) return false;
        if (c.pattern.toLowerCase() === commandText) return true;
        if (c.alias && c.alias.map((a) => a.toLowerCase()).includes(commandText))
          return true;
        return false;
      });

      if (cmd) {
        if (cmd.react) {
          await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
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
            send,
            quoted: chama,
          });
        } catch (e) {
          console.error("[PLUGIN ERROR]", e);
          reply("⚠️ An error occurred while executing the command.");
        }
      }
    });
  } catch (err) {
    console.error("❌ Error connecting to WhatsApp:", err);
    setTimeout(() => connectToWA(), 5000);
  }
}

setTimeout(() => {
  connectToWA();
}, 4000);
