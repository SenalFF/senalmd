// ================== SENAL-MD BOT MAIN SCRIPT ==================
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const path = require("path");
const P = require("pino");
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("✅ SENAL-MD BOT IS RUNNING"));
app.listen(port, () => console.log(`🌐 Express running on port ${port}`));

// ================== GLOBAL SETTINGS ==================
const prefix = ".";
const ownerNumber = ["94769872326"]; // <== your WhatsApp number
const sessionName = "SENAL-MD";

// ================== LOAD PLUGINS ==================
const commands = [];
const pluginFolder = path.join(__dirname, "plugins");

fs.readdirSync(pluginFolder).forEach(file => {
  if (file.endsWith(".js")) {
    const plugin = require(path.join(pluginFolder, file));
    if (plugin.pattern && typeof plugin.function === "function") {
      commands.push(plugin);
      console.log(`✅ Loaded plugin: ${file}`);
    }
  }
});

// ================== MAIN FUNCTION ==================
async function startSenalMD() {
  const { state, saveCreds } = await useMultiFileAuthState(sessionName);
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    browser: Browsers.macOS("Safari"),
    logger: P({ level: "silent" })
  });

  conn.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log("❌ Connection closed:", reason);
      if (reason !== DisconnectReason.loggedOut) {
        startSenalMD();
      } else {
        console.log("⚠️ Logged out. Please delete session and re-scan QR.");
      }
    } else if (connection === "open") {
      console.log("✅ Senal-MD Bot Connected Successfully!");
      conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
        text: "🎉 Well done Mr Senal — Bot is connected successfully!"
      });
    }
  });

  conn.ev.on("creds.update", saveCreds);

  // ================== MESSAGE HANDLER ==================
  conn.ev.on("messages.upsert", async (update) => {
    try {
      const mek = update.messages?.[0];
      if (!mek || !mek.message) return;

      if (mek.key.remoteJid === "status@broadcast") return;

      const contentType = getContentType(mek.message);
      const msg =
        contentType === "ephemeralMessage"
          ? mek.message.ephemeralMessage.message
          : mek.message;

      const type = getContentType(msg);
      const body =
        msg.conversation ||
        msg?.extendedTextMessage?.text ||
        msg?.imageMessage?.caption ||
        msg?.videoMessage?.caption ||
        "";

      if (!body) return;

      const from = mek.key.remoteJid;
      const isGroup = from.endsWith("@g.us");
      const sender = mek.key.fromMe
        ? conn.user.id.split(":")[0] + "@s.whatsapp.net"
        : mek.key.participant || mek.key.remoteJid;
      const senderNumber = sender.split("@")[0];
      const pushname = mek.pushName || "No Name";

      const isCmd = body.startsWith(prefix);
      if (!isCmd) return;

      const args = body.trim().split(/ +/);
      const command = args.shift().slice(prefix.length).toLowerCase();
      const q = args.join(" ");
      const isOwner = ownerNumber.includes(senderNumber);
      const reply = (text) => conn.sendMessage(from, { text }, { quoted: mek });

      console.log(`📩 CMD: ${command} | FROM: ${pushname} | BODY: ${body}`);

      // Find and run command
      const cmd = commands.find(
        (c) =>
          c.pattern === command ||
          (Array.isArray(c.alias) && c.alias.includes(command))
      );

      if (!cmd) return;

      // React emoji if available
      if (cmd.react) {
        try {
          await conn.sendMessage(from, {
            react: { text: cmd.react, key: mek.key },
          });
        } catch {}
      }

      // Run command
      await cmd.function(conn, mek, msg, {
        from,
        body,
        args,
        q,
        sender,
        senderNumber,
        isGroup,
        isOwner,
        pushname,
        reply,
      });

    } catch (err) {
      console.error("❌ Message handler error:", err);
    }
  });
}

startSenalMD();
