// project/plugin/videodl.js

const { cmd } = require("../command");
const yts = require("yt-search"); // For getting video details
const { ytmp4 } = require("@kelvdra/scraper"); // For getting the download link
const axios = require("axios");

// --- Configuration ---
const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_INLINE_VIDEO_SIZE = 64 * 1024 * 1024; // 64 MB for sending as 'video'

const sessions = {}; // To store user's video choice temporarily

/**
 * A utility to format bytes into a human-readable string.
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Gets the file size from a URL efficiently using a HEAD request.
 * @param {string} url The URL of the file.
 * @returns {Promise<number>} The size of the file in bytes.
 */
async function getFileSize(url) {
  try {
    const response = await axios.head(url, { timeout: 15000 });
    if (response.headers['content-length']) {
      return Number(response.headers['content-length']);
    }
  } catch (error) {
    console.warn("HEAD request failed. It's okay, we can proceed without the exact size.", error.message);
  }
  return 0; // Return 0 if size cannot be determined beforehand
}

// --- Main Command to Search for the Video ---
cmd(
  {
    pattern: "vid",
    desc: "📥 YouTube Video Downloader.",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    if (!q) return reply("🔍 Please provide a video name or YouTube link.");

    const from = mek.key.remoteJid;

    try {
      await reply("🔎 Searching video on YouTube...");
      
      // Step 1: Use yt-search to get video details
      const searchResults = await yts(q);
      const video = searchResults.videos[0];
      if (!video) return reply("❌ Video not found.");
      
      await reply("⏬ Getting download link...");

      // Step 2: Use @kelvdra/scraper to get the download URL
      // We will fetch a low-quality link first to get an approximate size
      const result = await ytmp4(video.url, "360"); // Quality can be changed here
      if (!result?.download?.url) {
        return reply("❌ Could not get a download link from the scraper.");
      }

      const fileSize = await getFileSize(result.download.url);
      const sizeFormatted = fileSize > 0 ? formatBytes(fileSize) : "Unknown";

      // Store all necessary info in the session
      sessions[from] = {
        title: video.title,
        downloadUrl: result.download.url, // The most important part
        size: fileSize,
        sizeFormatted: sizeFormatted,
        step: "choose_format",
      };

      const infoCaption = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
📦 *Approx. Size:* ${sizeFormatted} (at 360p)
🔗 *URL:* ${video.url}

*Reply with one of the following commands:*
🔹 Reply with *vid1* - Send as a standard video
🔹 Reply with *vid2* - Send as a document file
`;

      await robin.sendMessage(from, { image: { url: video.thumbnail }, caption: infoCaption }, { quoted: mek });
    } catch (err) {
      console.error("Error in .vid command:", err);
      reply("❌ An error occurred. The scraper might have failed or the video is unavailable.");
    }
  }
);


/**
 * Core function to handle the download and sending process.
 */
async function handleDownload(robin, mek, m, { reply }, sendAsDocument = false) {
    const from = mek.key.remoteJid;
    const session = sessions[from];

    if (!session || session.step !== "choose_format") {
      return reply("Please search for a video with the `.vid` command first.");
    }

    session.step = "sending"; // Prevent multiple triggers

    try {
      const { title, downloadUrl, size, sizeFormatted } = session;
      
      await reply(`✅ Preparing your video...\n*Title:* ${title}\n*Size:* ${sizeFormatted}`);

      // Get the video stream from the URL provided by the scraper
      // CRITICAL: NO TIMEOUT is set, allowing for large file downloads.
      const response = await axios.get(downloadUrl, {
        responseType: "stream",
      });
      const stream = response.data;
      
      // Determine if we should send as a document or a video
      const sendAsVideo = !sendAsDocument && size < MAX_INLINE_VIDEO_SIZE && size > 0;

      if (sendAsVideo) {
        await reply("📡 Streaming video directly. Please wait...");
        await robin.sendMessage(
          from,
          {
            video: { stream },
            mimetype: 'video/mp4',
            fileName: `${title.slice(0, 50)}.mp4`,
            caption: `🎬 *${title}*`,
          },
          { quoted: mek }
        );
      } else {
        await reply("📡 Streaming video as a document file. Please wait, this may take a while...");
        await robin.sendMessage(
          from,
          {
            document: { stream },
            mimetype: 'video/mp4',
            fileName: `${title.slice(0, 50)}.mp4`,
            caption: `✅ *Sent as Document*\n\n🎬 *Title:* ${title}\n📦 *Size:* ${sizeFormatted}`,
          },
          { quoted: mek }
        );
      }
    } catch (err) {
      console.error("Error during download/send:", err);
      reply("❌ Failed to send the video. The download link may have expired or the stream was interrupted.");
    } finally {
      delete sessions[from]; // Clean up the session to save memory
    }
}

// --- Command to download as Video (vid1) ---
cmd({ pattern: "vid1", desc: "Send YT video.", dontAddCommandList: true },
  (robin, mek, m, args) => handleDownload(robin, mek, m, args, false)
);

// --- Command to download as Document (vid2) ---
cmd({ pattern: "vid2", desc: "Send YT video as document.", dontAddCommandList: true },
  (robin, mek, m, args) => handleDownload(robin, mek, m, args, true)
);
