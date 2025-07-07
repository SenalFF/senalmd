const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("hydra_scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB for inline video
const sessions = {};

// 📥 Download from direct URL
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// 📹 Send as inline video
async function sendVideo(robin, from, mek, buffer, title) {
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

// 📄 Send as document
async function sendDocument(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "✅ *Sent by SENAL MD* 🎥",
    },
    { quoted: mek }
  );
}

// 🎬 Main command
cmd(
  {
    pattern: "video",
    desc: "📥 Download YouTube Video (MP4)",
    category: "download",
    react: "🎞️",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

      await reply("🔎 Searching for your video...");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Couldn't find video. Try another keyword.*");

      const url = video.url;
      const quality = "360";

      await reply("🔗 Getting video link...");

      const result = await ytmp4(url, quality);
      if (!result?.status || !result.download) {
        return reply("❌ Couldn't get video download URL.");
      }

      const buffer = await downloadFile(result.download);
      const filesize = buffer.length;
      const filesizeMB = (filesize / 1024 / 1024).toFixed(2);

      sessions[from] = {
        video,
        buffer,
        filesize,
        step: "choose_format",
      };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
📦 *File Size:* ${filesizeMB} MB
👁️ *Views:* ${video.views.toLocaleString()}
🔗 *URL:* ${url}

📁 *Choose the format:*
1️⃣ Video
2️⃣ Document

✍️ _Reply with 1 or 2_

⚠️ _WhatsApp max inline video: 50MB_
`;

      await robin.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption: info,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("YT VIDEO ERROR:", err);
      return reply("❌ *An error occurred while processing the video.*");
    }
  }
);

// 1️⃣ Send as inline video
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";

    try {
      if (session.filesize > MAX_VIDEO_SIZE) {
        await reply(`⚠️ *Video too large (${(session.filesize / 1024 / 1024).toFixed(2)}MB). Sending as document...*`);
        await sendDocument(robin, from, mek, session.buffer, session.video.title);
        await reply("✅ *Document sent successfully!* 📄");
      } else {
        await reply("📤 Sending video...");
        await sendVideo(robin, from, mek, session.buffer, session.video.title);
        await reply("✅ *Video sent successfully!* 🎥");
      }
    } catch (err) {
      console.error("Inline send error:", err);
      await reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// 2️⃣ Send as document
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";

    try {
      await reply("📤 Sending as document...");
      await sendDocument(robin, from, mek, session.buffer, session.video.title);
      await reply("✅ *Document sent successfully!* 📄");
    } catch (err) {
      console.error("Document send error:", err);
      await reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);
