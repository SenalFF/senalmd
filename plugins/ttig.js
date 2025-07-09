// TikTok Downloader using @mrnima/tiktok-downloader

const { cmd } = require("../command");
const axios = require("axios");
const { downloadTiktok } = require("@mrnima/tiktok-downloader");
const { https } = require("follow-redirects");

const MAX_INLINE_SIZE = 16 * 1024 * 1024; // 16MB
const sessions = {};

// Normalize TikTok URL
async function normalizeTikTokLink(link) {
  return new Promise((resolve, reject) => {
    if (!link.startsWith("http")) link = "https://" + link;
    const req = https.get(link, (res) => resolve(res.responseUrl || link));
    req.on("error", reject);
  });
}

// Download buffer
async function getBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// Send as video
async function sendVideo(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      video: buffer,
      mimetype: "video/mp4",
      caption: `🎬 *${title}*`,
    },
    { quoted: mek }
  );
}

// Send as document
async function sendDoc(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "📤 *TikTok Video by SENAL MD*",
    },
    { quoted: mek }
  );
}

// TikTok command
cmd(
  {
    pattern: "tiktok",
    desc: "📥 Download TikTok video",
    category: "download",
    react: "🎵",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    if (!q || !q.includes("tiktok")) return reply("🔗 *Please provide a valid TikTok link.*");

    try {
      await reply("🔍 Getting TikTok video...");

      const fullUrl = await normalizeTikTokLink(q);
      const result = await downloadTiktok(fullUrl);
      if (!result.status || !result.result.dl_link.download_mp4_hd) {
        return reply("❌ *Failed to get video download link.*");
      }

      const videoURL = result.result.dl_link.download_mp4_hd || result.result.dl_link.download_mp4_1;
      const title = result.result.title || "TikTok Video";
      const thumb = result.result.image;
      const buffer = await getBuffer(videoURL);
      const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);

      sessions[from] = {
        buffer,
        title,
        sizeMB,
        step: "tt_select",
      };

      await robin.sendMessage(
        from,
        {
          image: { url: thumb },
          caption: `🎥 *TikTok Video Found!*

📝 *Title:* ${title}
📦 *Size:* ${sizeMB} MB

1️⃣ Inline Video
2️⃣ Document

_Reply with 1 or 2 to receive it._`,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error("TikTok DL Error:", e);
      reply("❌ *Failed to download TikTok video.*");
    }
  }
);

// Reply with "1" for inline
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const s = sessions[from];
    if (!s || s.step !== "tt_select") return;

    if (s.buffer.length > MAX_INLINE_SIZE) {
      await reply("⚠️ File too large. Sending as document.");
      await sendDoc(robin, from, mek, s.buffer, s.title);
    } else {
      await sendVideo(robin, from, mek, s.buffer, s.title);
    }

    delete sessions[from];
  }
);

// Reply with "2" for document
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const s = sessions[from];
    if (!s || s.step !== "tt_select") return;

    await sendDoc(robin, from, mek, s.buffer, s.title);
    delete sessions[from];
  }
);
