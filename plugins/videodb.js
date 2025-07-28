const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_INLINE_VIDEO_SIZE = 64 * 1024 * 1024; // 64 MB

const sessions = {};

// Format bytes to readable string
function formatBytes(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get file size from HEAD request
async function getFileSize(url) {
  try {
    const res = await axios.head(url, { timeout: 10000 });
    return res.headers['content-length'] ? Number(res.headers['content-length']) : 0;
  } catch (err) {
    console.warn("File size fetch failed:", err.message);
    return 0;
  }
}

// Clean title for filename
function sanitizeTitle(title) {
  return title.replace(/[^\w\s\-]/gi, '').replace(/\s+/g, '_').slice(0, 50);
}

// Main .vid command
cmd({
  pattern: "vid",
  desc: "📥 YouTube Video Downloader.",
  category: "download",
  react: "📹",
}, async (robin, mek, m, { q, reply }) => {
  if (!q) return reply("🔍 Please provide a video name or YouTube link.");
  const from = mek.key.remoteJid;

  try {
    await reply("🔎 Searching video on YouTube...");

    const search = await yts(q);
    const video = search.videos[0];
    if (!video) return reply("❌ Video not found.");

    await reply("⏬ Fetching download link...");

    const result = await ytmp4(video.url, "360");
    if (!result?.download?.url) {
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
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 mins expiry
    };

    const caption = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp || 'Unknown'}
📦 *Size (360p):* ${sizeFormatted}
🔗 *URL:* ${video.url}

*Reply with:*
▶️ *vid1* — Send as video  
📁 *vid2* — Send as document
    `.trim();

    await robin.sendMessage(from, {
      image: { url: video.thumbnail },
      caption,
    }, { quoted: mek });

  } catch (err) {
    console.error("Error in .vid:", err);
    reply("❌ Error: Could not fetch video. Try another link or later.");
  }
});

// Download and send function
async function handleDownload(robin, mek, m, { reply }, sendAsDocument = false) {
  const from = mek.key.remoteJid;
  const session = sessions[from];

  if (!session || session.step !== "choose_format") {
    return reply("🔁 Use `.vid` command first to search a video.");
  }

  if (Date.now() > session.expiresAt) {
    delete sessions[from];
    return reply("⏳ Session expired. Please search the video again.");
  }

  session.step = "sending";

  try {
    const { title, downloadUrl, size, sizeFormatted } = session;
    const safeTitle = sanitizeTitle(title);
    const fileName = `${safeTitle}.mp4`;

    await reply(`✅ Preparing video...\n🎞️ *Title:* ${title}\n📦 *Size:* ${sizeFormatted}`);

    const response = await axios.get(downloadUrl, { responseType: "stream" });
    const stream = response.data;
    const mime = response.headers['content-type'] || 'video/mp4';

    const asVideo = !sendAsDocument && size < MAX_INLINE_VIDEO_SIZE && size > 0;

    if (asVideo) {
      await reply("📡 Uploading as video...");
      await robin.sendMessage(from, {
        video: { stream },
        mimetype: mime,
        fileName,
        caption: `🎬 *${title}*`,
      }, { quoted: mek });
    } else {
      await reply("📡 Uploading as document...");
      await robin.sendMessage(from, {
        document: { stream },
        mimetype: mime,
        fileName,
        caption: `✅ *Sent as Document*\n\n🎬 *Title:* ${title}\n📦 *Size:* ${sizeFormatted}`,
      }, { quoted: mek });
    }

  } catch (err) {
    console.error("Download/send error:", err);
    reply("❌ Failed to send video. Link may have expired or stream interrupted.");
  } finally {
    delete sessions[from];
  }
}

// .vid1 - Send as video
cmd({
  pattern: "vid1",
  desc: "Send YouTube video.",
  dontAddCommandList: true,
}, (robin, mek, m, args) => handleDownload(robin, mek, m, args, false));

// .vid2 - Send as document
cmd({
  pattern: "vid2",
  desc: "Send YouTube video as document.",
  dontAddCommandList: true,
}, (robin, mek, m, args) => handleDownload(robin, mek, m, args, true));

// Optional: auto-clear expired sessions every 1 minute
setInterval(() => {
  for (const key in sessions) {
    if (Date.now() > sessions[key]?.expiresAt) {
      delete sessions[key];
    }
  }
}, 60 * 1000);
