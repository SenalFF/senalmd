const { cmd } = require("../command");
const axios = require("axios");
const { tiktokdl } = require("ruhend-scraper"); // For TikTok
const { instagramdl } = require("ruhend-scraper"); // For Instagram

const MAX_INLINE_SIZE = 16 * 1024 * 1024; // 16 MB
const sessions = {};

// Download buffer from URL
async function downloadBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// Send inline video
async function sendInlineVideo(robin, from, mek, buffer, title) {
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
async function sendDocumentVideo(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "📁 *Sent by SENAL MD*",
    },
    { quoted: mek }
  );
}

// ========== TikTok Downloader ==========
cmd(
  {
    pattern: "tt",
    desc: "📥 Download TikTok Video",
    category: "download",
    react: "🎵",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    if (!q || !q.includes("tiktok.com")) return reply("🔗 *Please provide a valid TikTok video link.*");

    try {
      await reply("🔍 Fetching TikTok video info...");
      const data = await tiktokdl(q);
      const result = data?.data[0];
      if (!result?.url) return reply("❌ *Failed to get TikTok download link.*");

      const buffer = await downloadBuffer(result.url);
      const filesizeMB = (buffer.length / 1024 / 1024).toFixed(2);

      sessions[from] = {
        type: "tiktok",
        url: result.url,
        title: "TikTok_Video",
        buffer,
        size: buffer.length,
        step: "await_reply",
      };

      await robin.sendMessage(
        from,
        {
          image: { url: result.cover || "https://i.imgur.com/8fKQF1U.jpg" },
          caption: `🎵 *TikTok Video Downloader*\n\n📦 *Size:* ${filesizeMB} MB\n\nReply:\n1️⃣ Inline Video (max 16MB)\n2️⃣ Document`,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("TikTok error:", err);
      return reply("❌ *Error downloading TikTok video.*");
    }
  }
);

// ========== Instagram Downloader ==========
cmd(
  {
    pattern: "ig",
    desc: "📥 Download Instagram Video",
    category: "download",
    react: "📸",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    if (!q || !q.includes("instagram.com")) return reply("🔗 *Please provide a valid Instagram video link.*");

    try {
      await reply("🔍 Fetching Instagram video info...");
      const data = await instagramdl(q);
      const result = data?.data[0];
      if (!result?.url) return reply("❌ *Failed to get Instagram video link.*");

      const buffer = await downloadBuffer(result.url);
      const filesizeMB = (buffer.length / 1024 / 1024).toFixed(2);

      sessions[from] = {
        type: "instagram",
        url: result.url,
        title: "Instagram_Video",
        buffer,
        size: buffer.length,
        step: "await_reply",
      };

      await robin.sendMessage(
        from,
        {
          image: { url: result.thumbnail || "https://i.imgur.com/8fKQF1U.jpg" },
          caption: `📸 *Instagram Video Downloader*\n\n📦 *Size:* ${filesizeMB} MB\n\nReply:\n1️⃣ Inline Video (max 16MB)\n2️⃣ Document`,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("Instagram error:", err);
      return reply("❌ *Error downloading Instagram video.*");
    }
  }
);

// ========== Handle Reply: 1 ==========
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

    session.step = "sending";

    try {
      if (session.size <= MAX_INLINE_SIZE) {
        await reply("📤 Sending as inline video...");
        await sendInlineVideo(robin, from, mek, session.buffer, session.title);
      } else {
        await reply("⚠️ Too large for inline. Sending as document...");
        await sendDocumentVideo(robin, from, mek, session.buffer, session.title);
      }
    } catch (err) {
      console.error("Reply 1 error:", err);
      await reply("❌ Failed to send video.");
    }

    delete sessions[from];
  }
);

// ========== Handle Reply: 2 ==========
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

    session.step = "sending";

    try {
      await reply("📤 Sending as document...");
      await sendDocumentVideo(robin, from, mek, session.buffer, session.title);
    } catch (err) {
      console.error("Reply 2 error:", err);
      await reply("❌ Failed to send document.");
    }

    delete sessions[from];
  }
)
