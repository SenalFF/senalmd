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

// ================= Owner =================
const ownerNumber = [config.OWNER_NUMBER || "94769872326"];

// ================= SESSION AUTH =================
const authPath = path.join(__dirname, "auth_info_baileys");
const credsFile = path.join(authPath, "creds.json");

if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });

async function ensureSession() {
  if (!fs.existsSync(credsFile)) {
    if (!config.SESSION_ID) {
      console.log("❌ Please add your SESSION_ID in .env!");
      process.exit(1);
    }

    const { File } = require("megajs");
    const sessdata = config.SESSION_ID;
    const file = File.fromURL(`https://mega.nz/file/${sessdata}`);

    console.log("⏳ Downloading session file from Mega...");
    await new Promise((resolve, reject) => {
      file.download().pipe(fs.createWriteStream(credsFile))
        .on("finish", () => {
          console.log("✅ Session downloaded successfully");
          resolve();
        })
        .on("error", (err) => reject(err));
    });
  }
}

// ================= Express Server =================
const app = express();
const port = process.env.PORT || 8000;

app.get("/", (req, res) => res.send("Hey, Senal MD started ✅"));

app.listen(port, () =>
  console.log(`🌐 Server listening on http://localhost:${port}`)
);

// ================= Fake Status / Contact =================
const fakeStatus = {
  key: {
    remoteJid: "status@broadcast",
    participant: "0@s.whatsapp.net",
    fromMe: false,
    id: "FAKE_STATUS_ID_12345",
  },
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
    await ensureSession(); // Wait for session file

    const prefix = config.PREFIX || ".";
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
        if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
          console.log("🔄 Reconnecting in 5 seconds...");
          setTimeout(connectToWA, 5000); // avoid flood loop
        } else {
          console.log("❌ Logged out from WhatsApp");
        }
      } else if (connection === "open") {
        console.log("✅ Bot connected to WhatsApp");
      }
    });

    conn.ev.on("creds.update", saveCreds);

    // ================= Handle Incoming Messages =================
    conn.ev.on("messages.upsert", async (mek) => {
      mek = mek.messages[0];
      if (!mek?.message) return;

      // Your existing message handling code...
    });

  } catch (err) {
    console.error("❌ Error connecting to WhatsApp:", err);
    console.log("🔄 Retrying in 10 seconds...");
    setTimeout(connectToWA, 10000);
  }
}

// Start bot safely
setTimeout(connectToWA, 2000);
