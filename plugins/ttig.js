const { cmd } = require("../command");
const axios = require("axios");
const { TiktokDL } = require("@nekochii/scraper");

const MAX_INLINE = 16 * 1024 * 1024;
const sessions = {};

// Download buffer from URL
async function downloadBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// Send inline video
async function sendInline(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      video: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: `🎬 *${title}*`,
    },
    { quoted: mek }
  );
}

// Send as document
async function sendDocument(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "✅ *TikTok video sent by SENAL MD*",
    },
    { quoted: mek }
  );
}

// ⏬ Main TikTok Command
cmd(
  {
    pattern: "tt",
    desc: "📥 Download TikTok video",
    category: "download",
    react: "🎵",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    if (!q || !q.includes("tiktok.com")) return reply("🔗 *Please send a valid TikTok link.*");

    try {
      await reply("🔍 Fetching TikTok video...");

      const result = await TiktokDL(q);
      const dl = result?.result?.nowm;
      const thumbnail = result?.result?.thumbnail || "https://i.imgur.com/8fKQF1U.jpg";
      const title = result?.result?.description || "TikTok_Video";

      if (!dl) return reply("❌ *Failed to get download link.*");

      const buffer = await downloadBuffer(dl);
      const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);

      sessions[from] = {
        title,
        url: dl,
        buffer,
        size: buffer.length,
        step: "await_reply",
      };

      await robin.sendMessage(
        from,
        {
          image: { url: thumbnail },
          caption: `🎵 *TikTok Downloader*\n\n📄 *Title:* ${title}\n📦 *Size:* ${sizeMB} MB\n\nChoose how to send:\n1️⃣ Inline Video\n2️⃣ Document\n\n_Reply with 1 or 2_`,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("TT error:", err);
      reply("❌ *Error downloading TikTok video. Try again later.*");
    }
  }
);

// 🧾 Handle reply 1 (Inline)
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "await_reply") return;

    try {
      if (session.size > MAX_INLINE) {
        await reply(`⚠️ Video is too large (${(session.size / 1024 / 1024).toFixed(2)} MB), sending as document...`);
        await sendDocument(robin, from, mek, session.buffer, session.title);
      } else {
        await reply("📤 Sending as inline video...");
        await sendInline(robin, from, mek, session.buffer, session.title);
      }
      await reply("✅ *Sent successfully!*");
    } catch (err) {
      console.error("Inline error:", err);
      await reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// 📁 Handle reply 2 (Document)
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "await_reply") return;

    try {
      await reply("📤 Sending as document...");
      await sendDocument(robin, from, mek, session.buffer, session.title);
      await reply("✅ *Document sent!*");
    } catch (err) {
      console.error("Doc error:", err);
      await reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
