// youtube.js
const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Limits
const MAX_INLINE_SIZE = 100 * 1024 * 1024; // 100MB inline
const MAX_DOC_SIZE = 2 * 1024 * 1024 * 1024; // 2GB doc

// Temp folder
const TEMP_DIR = path.join(__dirname, "../temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Sessions
const sessions = {};

// Stream download to file
async function downloadToFile(url, title) {
  const filePath = path.join(TEMP_DIR, `${Date.now()}-${title.slice(0, 20)}.mp4`);
  const writer = fs.createWriteStream(filePath);

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(filePath));
    writer.on("error", reject);
  });
}

// Send inline video
async function sendVideo(robin, from, mek, filePath, title) {
  await robin.sendMessage(
    from,
    {
      video: fs.readFileSync(filePath),
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: `🎬 *${title}*`,
    },
    { quoted: mek }
  );
  fs.unlinkSync(filePath);
}

// Send as document
async function sendDocument(robin, from, mek, filePath, title) {
  await robin.sendMessage(
    from,
    {
      document: fs.readFileSync(filePath),
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "✅ *Document sent by SENAL MD* 🎥",
    },
    { quoted: mek }
  );
  fs.unlinkSync(filePath);
}

// ▶️ .video command
cmd(
  {
    pattern: "video",
    desc: "📥 YouTube Video Downloader",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;

    if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

    try {
      await reply("🔎 Searching for your video...");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Video not found. Try again.*");

      // Save session
      sessions[from] = { video };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

📁 *Choose file type below:*
`;

      const buttons = [
        { buttonId: `.video1`, buttonText: { displayText: "🎥 Inline Video" }, type: 1 },
        { buttonId: `.video2`, buttonText: { displayText: "📁 Document" }, type: 1 },
      ];

      await robin.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption: info,
          footer: "SENAL MD YouTube Downloader",
          buttons,
          headerType: 4,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("YT Video Error:", err);
      return reply("❌ *Error while searching video. Try again later.*");
    }
  }
);

// 📽️ video1: inline
cmd(
  {
    pattern: "video1",
    desc: "Send YouTube video inline",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session) return reply("❌ *No active video session. Use .video first.*");

    try {
      await reply("⏬ Fetching video download link...");
      const result = await ytmp4(session.video.url, "360");
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      const title = result.title || "YouTube Video";
      const filePath = await downloadToFile(result.download.url, title);
      const filesize = fs.statSync(filePath).size;

      if (filesize > MAX_INLINE_SIZE) {
        await reply(`⚠️ *File is ${(filesize / 1024 / 1024).toFixed(2)} MB — sending as document instead.*`);
        await sendDocument(robin, from, mek, filePath, title);
      } else {
        await reply("📤 Uploading inline video...");
        await sendVideo(robin, from, mek, filePath, title);
      }

      await reply("✅ *Video sent successfully!*");
    } catch (err) {
      console.error("Video1 send error:", err);
      await reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// 📁 video2: document
cmd(
  {
    pattern: "video2",
    desc: "Send YouTube video as document",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session) return reply("❌ *No active video session. Use .video first.*");

    try {
      await reply("⏬ Fetching video download link...");
      const result = await ytmp4(session.video.url, "360");
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      const title = result.title || "YouTube Video";
      const filePath = await downloadToFile(result.download.url, title);
      const filesize = fs.statSync(filePath).size;

      if (filesize > MAX_DOC_SIZE) {
        fs.unlinkSync(filePath);
        return reply("⚠️ *File too large. WhatsApp supports max 2GB.*");
      }

      await reply("📤 Uploading document...");
      await sendDocument(robin, from, mek, filePath, title);

      await reply("✅ *Document sent successfully!*");
    } catch (err) {
      console.error("Video2 send error:", err);
      await reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
