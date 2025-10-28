// ================= Load Environment Variables =================
const dotenv = require("dotenv");
dotenv.config();

if (!process.env.OWNER_NUMBER) {
  console.error("❌ OWNER_NUMBER not set in .env!");
  process.exit(1);
}

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
const { sms } = require("./lib/msg");
const config = require("./config");

// ================= Owner =================
const ownerNumber = [process.env.OWNER_NUMBER || "94769872326"];

// ================= Express Server =================
const app = express();
const port = process.env.PORT || 8000;

app.get("/", (req, res) => res.send("Hey, Senal MD started ✅"));

app.listen(port, () =>
  console.log(`🌐 Server listening on http://localhost:${port}`)
);

// ================= Fake Status =================
const fakeStatus = {
  key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "FAKE_STATUS_ID_12345" },
  message: {
    contactMessage: {
      displayName: "Senal MD Bot",
      vcard: `BEGIN:VCARD
VERSION:3.0
N:Senal MD Bot;;;;
FN:Senal MD Bot
ORG:Senal MD
TEL;type=CELL;type=VOICE;waid=1234567890:+1234567890
END:VCARD`,
    },
  },
};

// ================= Connect to WhatsApp =================
async function connectToWA() {
  try {
    const authPath = path.join(__dirname, "auth_info_baileys");
    if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
      logger: P({ level: "silent" }),
      printQRInTerminal: true, // QR code will show if no session exists
      browser: Browsers.macOS("Firefox"),
      syncFullHistory: true,
      auth: state,
      version,
    });

    // ================= Connection Updates =================
    conn.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log("Connection closed. Reconnect:", shouldReconnect);
        if (shouldReconnect) setTimeout(connectToWA, 5000);
        else console.log("❌ Logged out from WhatsApp. Scan QR again to generate a new session.");
      } else if (connection === "open") {
        console.log("✅ Bot connected to WhatsApp");
      }
    });

    // ================= Save Credentials =================
    conn.ev.on("creds.update", saveCreds);

    // ================= Handle Incoming Messages =================
    conn.ev.on("messages.upsert", async (event) => {
      const messages = event.messages;
      for (const mek of messages) {
        if (!mek.message) continue;

        // Handle ephemeral messages
        mek.message = getContentType(mek.message) === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;

        const m = sms(conn, mek);
        const from = mek.key.remoteJid;
        const contentType = getContentType(mek.message);
        let body = "";
        if (contentType === "conversation") body = mek.message.conversation;
        else if (contentType === "extendedTextMessage") body = mek.message.extendedTextMessage.text;
        else if (contentType === "buttonsResponseMessage") body = mek.message.buttonsResponseMessage.selectedButtonId;
        else if (contentType === "listResponseMessage") body = mek.message.listResponseMessage.singleSelectReply.selectedRowId;

        const prefix = process.env.PREFIX || ".";
        const isCmd = body.startsWith(prefix);
        const commandText = isCmd ? body.slice(prefix.length).trim().split(/ +/)[0].toLowerCase() : body.toLowerCase();
        const args = body.trim().split(/ +/).slice(isCmd ? 1 : 0);
        const q = args.join(" ");
        const isGroup = from.endsWith("@g.us");
        const sender = mek.key.fromMe ? conn.user.id.split(":")[0] + "@s.whatsapp.net" : mek.key.participant || mek.key.remoteJid;
        const senderNumber = sender.split("@")[0];
        const botNumber = conn.user.id.split(":")[0];
        const pushname = mek.pushName || "No Name";
        const isOwner = ownerNumber.includes(senderNumber) || senderNumber === botNumber;

        const reply = (text, extra = {}) => conn.sendMessage(from, { text, ...extra }, { quoted: mek });

        // Load commands
        const events = require("./command");
        const cmd = events.commands.find((c) => {
          if (!c.pattern) return false;
          if (c.pattern.toLowerCase() === commandText) return true;
          if (c.alias && c.alias.map(a => a.toLowerCase()).includes(commandText)) return true;
          return false;
        });

        if (cmd) {
          if (cmd.react) await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
          try {
            await cmd.function(conn, mek, m, { from, body, isCmd, command: commandText, args, q, isGroup, sender, senderNumber, botNumber, pushname, isOwner, reply });
          } catch (e) {
            console.error("[PLUGIN ERROR]", e);
            reply("⚠️ An error occurred while executing the command.");
          }
        }
      }
    });

  } catch (err) {
    console.error("❌ Error connecting to WhatsApp:", err);
    console.log("🔄 Retrying in 10 seconds...");
    setTimeout(connectToWA, 10000);
  }
}

// Start bot
connectToWA();
