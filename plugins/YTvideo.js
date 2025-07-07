const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("hydra_scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB limit for inline video
const sessions = {};

// Download video buffer
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// Send inline video
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

// Send as document
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

// Main .video command
cmd(
  {
    pattern: "video",
    desc: "📹 YouTube Video Downloader (MP4)",
    category: "download",
    react: "🎞️",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

      await reply("🔎 Searching for video...");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *No video found. Try another keyword.*");

      await reply("⬇️ Fetching video download info...");

      const result = await ytmp4(video.url, "360");
      if (!result.status || !result.download) return reply("❌ Couldn't get video download link.");

      const buffer = await downloadFile(result.download);
      const filesize = buffer.length;
      const filesizeMB = (filesize / (1024 * 1024)).toFixed(2);

      sessions[from] = {
        video,
        buffer,
        filesize,
        step: "choose_format",
      };

      const caption = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📦 *Size:* ${filesizeMB} MB
🔗 *Link:* ${video.url}

✍️ Reply with:
1️⃣ Send as Video
2️⃣ Send as Document

⚠️ Max inline video size: 50MB
`;

      await robin.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("Video Downloader Error:", err);
      return reply("❌ *Error occurred while processing video.*");
    }
  }
);

// Handle reply: "1" — send as inline video
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
        await reply(`⚠️ *Video is too large (${(session.filesize / 1024 / 1024).toFixed(2)}MB). Sending as document instead...*`);
        await sendDocument(robin, from, mek, session.buffer, session.video.title);
        await reply("✅ *Document sent successfully!* 📄");
      } else {
        await reply("📤 Sending video...");
        await sendVideo(robin, from, mek, session.buffer, session.video.title);
        await reply("✅ *Video sent successfully!* 🎬");
      }
    } catch (err) {
      console.error("Send inline video error:", err);
      await reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// Handle reply: "2" — send as document
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
      await reply("📤 Sending video as document...");
      await sendDocument(robin, from, mek, session.buffer, session.video.title);
      await reply("✅ *Document sent successfully!* 📄");
    } catch (err) {
      console.error("Send document error:", err);
      await reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
