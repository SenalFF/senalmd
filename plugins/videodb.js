const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB limit for inline videos
const sessions = {};

// Download video to disk using stream
async function downloadToFile(url, filePath) {
  const writer = fs.createWriteStream(filePath);
  const response = await axios({
    method: "get",
    url,
    responseType: "stream",
    timeout: 60000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

// Send inline video (from file)
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
}

// Send as document (from file)
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
}

// ▶️ .video command
cmd(
  {
    pattern: "vid",
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

      sessions[from] = { video, step: "choose_format" };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

📁 *Choose file type:*
🔹 *video1* - Send as Video
🔹 *video2* - Send as Document

✍️ _Reply with *vid1* or *vid2*_
`;

      await robin.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption: info },
        { quoted: mek }
      );
    } catch (err) {
      console.error("YT Video Error:", err);
      return reply("❌ *Error while searching video. Try again later.*");
    }
  }
);

// 📽️ video1: send inline video
cmd(
  {
    pattern: "vid1",
    desc: "Send YouTube video inline",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";

    try {
      await reply("⏬ Fetching video download link...");
      const result = await ytmp4(session.video.url, "360");
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      const tempFile = path.join(__dirname, `${Date.now()}.mp4`);
      await downloadToFile(result.download.url, tempFile);

      const fileSize = fs.statSync(tempFile).size;
      if (fileSize > MAX_VIDEO_SIZE) {
        await reply(`⚠️ File is ${(fileSize / 1024 / 1024).toFixed(2)} MB — sending as document instead.`);
        await sendDocument(robin, from, mek, tempFile, session.video.title);
      } else {
        await reply("📤 Uploading inline video...");
        await sendVideo(robin, from, mek, tempFile, session.video.title);
      }

      fs.unlinkSync(tempFile);
      await reply("✅ *Video sent successfully!*");
    } catch (err) {
      console.error("Video1 send error:", err);
      await reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// 📁 video2: send as document
cmd(
  {
    pattern: "vid2",
    desc: "Send YouTube video as document",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";

    try {
      await reply("⏬ Fetching video download link...");
      const result = await ytmp4(session.video.url, "360");
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      const tempFile = path.join(__dirname, `${Date.now()}.mp4`);
      await downloadToFile(result.download.url, tempFile);

      await reply("📤 Uploading document...");
      await sendDocument(robin, from, mek, tempFile, session.video.title);

      fs.unlinkSync(tempFile);
      await reply("✅ *Document sent successfully!*");
    } catch (err) {
      console.error("Video2 send error:", err);
      await reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
