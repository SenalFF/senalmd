const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_INLINE_VIDEO_SIZE = 64 * 1024 * 1024;   // 64 MB
const sessions = {};

// Format bytes
function formatBytes(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get file size via HEAD
async function getFileSize(url) {
  try {
    const res = await axios.head(url, { timeout: 10000 });
    return res.headers['content-length'] ? Number(res.headers['content-length']) : 0;
  } catch (err) {
    console.warn("File size fetch failed:", err.message);
    return 0;
  }
}

// Sanitize filename
function sanitizeTitle(title) {
  return title.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_').slice(0, 50);
}

// Main command
cmd({
  pattern: "vid",
  desc: "📥 YouTube Video Downloader.",
  category: "download",
  react: "📹",
}, async (robin, mek, m, { q, reply }) => {
  const from = mek.key.remoteJid;
  if (!q) return reply("🔍 Please provide a video name or YouTube link.");

  try {
    await reply("🔎 Searching video on YouTube...");
    const search = await yts(q);
    const video = search.videos[0];
    if (!video) return reply("❌ Video not found.");

    await reply("⏬ Fetching download link...");
    const result = await ytmp4(video.url, "360");
    if (!result?.download?.url || !result.download.url.startsWith("http")) {
      return reply("❌ Could not get download link. Maybe age-restricted or unsupported.");
    }

    const downloadUrl = result.download.url;
    const fileSize = await getFileSize(downloadUrl);
    const sizeFormatted = fileSize > 0 ? formatBytes(fileSize) : "Unknown";

    sessions[from] = {
      title: video.title,
      downloadUrl,
      size: fileSize,
      sizeFormatted,
      step: "choose_format",
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 mins
    };

    const caption = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp || 'Unknown'}
📦 *Size (360p):* ${sizeFormatted}
🔗 *URL:* ${video.url}

📩 *Reply with:*
▶️ *vid1* — Send as video
📁 *vid2* — Send as document`.trim();

    await robin.sendMessage(from, {
      image: { url: video.thumbnail },
      caption,
    }, { quoted: mek });

  } catch (err) {
    console.error("Error in .vid:", err);
    reply("❌ Error: Could not fetch video. Try another link or later.");
  }
});

// Downloader function
async function handleDownload(robin, mek, m, { reply }, sendAsDocument = false) {
  const from = mek.key.remoteJid;
  const session = sessions[from];

  if (!session || session.step !== "choose_format") {
    return reply("🔁 Use *.vid* first to search a video.");
  }

  if (Date.now() > session.expiresAt) {
    delete sessions[from];
    return reply("⏳ Session expired. Please search again.");
  }

  session.step = "sending";

  try {
    const { title, downloadUrl, size, sizeFormatted } = session;
    const safeTitle = sanitizeTitle(title);
    const fileName = `${safeTitle}.mp4`;
    const tempFilePath = path.join("/tmp", `${Date.now()}_${fileName}`);

    await reply(`✅ *Preparing video...*\n🎞️ *Title:* ${title}\n📦 *Size:* ${sizeFormatted}`);

    const response = await axios.get(downloadUrl, {
      responseType: "stream",
      timeout: 60000,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const writer = fs.createWriteStream(tempFilePath);
    response.data.pipe(writer);

    response.data.on("error", (err) => {
      console.error("❌ Stream error:", err.message);
      reply("❌ Download stream failed.");
    });

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", (err) => {
        console.error("❌ File write error:", err.message);
        reject(err);
      });
    });

    const sendInline = !sendAsDocument && size < MAX_INLINE_VIDEO_SIZE && size > 0;

    if (sendInline) {
      await reply("📡 Uploading as video...");
      await robin.sendMessage(from, {
        video: { url: tempFilePath },
        mimetype: "video/mp4",
        fileName,
        caption: `🎬 ${title}`,
      }, { quoted: mek });
    } else {
      await reply("📡 Uploading as document...");
      await robin.sendMessage(from, {
        document: { url: tempFilePath },
        mimetype: "video/mp4",
        fileName,
        caption: `✅ *Sent as Document*\n\n🎬 *Title:* ${title}\n📦 *Size:* ${sizeFormatted}`,
      }, { quoted: mek });
    }

    fs.unlinkSync(tempFilePath); // cleanup temp file

  } catch (err) {
    console.error("❌ Download/send error:", err.message || err);
    reply("❌ Failed to download or send video.");
  } finally {
    delete sessions[from];
  }
}

// Subcommands
cmd({
  pattern: "vid1",
  desc: "Send YouTube video (inline).",
  dontAddCommandList: true,
}, (robin, mek, m, args) => handleDownload(robin, mek, m, args, false));

cmd({
  pattern: "vid2",
  desc: "Send YouTube video as document.",
  dontAddCommandList: true,
}, (robin, mek, m, args) => handleDownload(robin, mek, m, args, true));

// Cleanup expired sessions
setInterval(() => {
  const now = Date.now();
  for (const key in sessions) {
    if (now > sessions[key]?.expiresAt) {
      delete sessions[key];
    }
  }
}, 60 * 1000);
