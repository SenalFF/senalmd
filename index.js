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

//=================== SESSION AUTH ============================
const authPath = __dirname + "/auth_info_baileys";
const credsFile = authPath + "/creds.json";

if (!fs.existsSync(authPath)) fs.mkdirSync(authPath);

if (!fs.existsSync(credsFile)) {
  if (!config.SESSION_ID) {
    console.log("❌ Please add your SESSION_ID in .env!");
    process.exit(1);
  }
  const { File } = require("megajs");
  const sessdata = config.SESSION_ID;
  const file = File.fromURL(`https://mega.nz/file/${sessdata}`);
  file.download().pipe(fs.createWriteStream(credsFile))
    .on("finish", () => console.log("✅ Session downloaded successfully"))
    .on("error", (err) => { throw err });
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
    // Connect MongoDB
    await connectDB();
    const envConfig = await readEnv();
    const prefix = envConfig.PREFIX || ".";

    console.log("⏳ Connecting Senal MD BOT...");

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
      logger: P({ level: "silent" }),
      printQRInTerminal: false,
      browser: Browsers.macOS("Firefox"),
      syncFullHistory: true,
      auth: state,
      version,
    });

    // ================= Connection Updates =================
    conn.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        if (
          lastDisconnect.error?.output?.statusCode !==
          DisconnectReason.loggedOut
        ) {
          console.log("🔄 Reconnecting...");
          connectToWA();
        } else {
          console.log("❌ Logged out from WhatsApp");
        }
      } else if (connection === "open") {
        console.log("✅ Bot connected to WhatsApp");

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
        const upMsg =
          envConfig.ALIVE_MSG || `Senal MD connected ✅\nPrefix: ${prefix}`;
        conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
          image: { url: envConfig.ALIVE_IMG },
          caption: upMsg,
        });
      }
    });

    conn.ev.on("creds.update", saveCreds);

    // ================= Handle Incoming Messages =================
    conn.ev.on("messages.upsert", async (mek) => {
      mek = mek.messages[0];
      if (!mek.message) return;

      // Handle ephemeral messages
      mek.message =
        getContentType(mek.message) === "ephemeralMessage"
          ? mek.message.ephemeralMessage.message
          : mek.message;

      // Auto-read status updates
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
        body =
          mek.message.listResponseMessage.singleSelectReply.selectedRowId;
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
        conn.sendMessage(from, { text, ...extra }, { quoted: mek });

      // ===== Load commands =====
      const events = require("./command");

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
          });
        } catch (e) {
          console.error("[PLUGIN ERROR]", e);
          reply("⚠️ An error occurred while executing the command.");
        }
      }
    });
  } catch (err) {
    console.error("❌ Error connecting to WhatsApp:", err);
  }
}

// Start bot after 4 seconds
setTimeout(() => {
  connectToWA();
}, 4000);
