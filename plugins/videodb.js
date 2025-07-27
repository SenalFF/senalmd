// project/plugin/videodl.js

const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper"); // Using your preferred scraper
const axios = require("axios");

// --- Configuration ---
const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_INLINE_VIDEO_SIZE = 64 * 1024 * 1024; // 64 MB

const sessions = {};

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
 * Gets the file size from a URL without downloading the whole file.
 * @param {string} url The URL of the file.
 * @returns {Promise<number>} The size of the file in bytes.
 */
async function getFileSize(url) {
  try {
    const response = await axios.head(url, { timeout: 15000 }); // Use HEAD request for efficiency
    if (response.headers['content-length']) {
      return Number(response.headers['content-length']);
    }
  } catch (error) {
    console.warn("HEAD request failed, falling back to range request. Error:", error.message);
    try {
      // Fallback for servers that don't support HEAD
      const response = await axios.get(url, {
        headers: { Range: "bytes=0-0" },
        timeout: 15000,
      });
      const contentRange = response.headers["content-range"];
      if (contentRange) {
        return Number(contentRange.split("/")[1]);
      }
    } catch (rangeError) {
      console.error("Could not determine file size from URL:", rangeError.message);
    }
  }
  return 0; // Return 0 if size cannot be determined
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
      await reply("🔎 Searching for video...");
      const searchResults = await yts(q);
      const video = searchResults.videos[0];
      if (!video) return reply("❌ Video not found.");
      
      await reply("⏬ Getting video details and size...");
      const result = await ytmp4(video.url, "360p"); // Assuming 360p is desired
      if (!result?.download?.url) {
        return reply("❌ Could not get video details from the scraper.");
      }

      const fileSize = await getFileSize(result.download.url);
      const sizeFormatted = formatBytes(fileSize);

      sessions[from] = {
        title: video.title,
        downloadUrl: result.download.url,
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
🔹 Reply with *vid1* - Send as a standard video (if under 64MB)
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

      // CRITICAL CHANGE: Get the stream from Axios WITHOUT a timeout.
      // The connection will stay open as long as data is flowing.
      const response = await axios.get(downloadUrl, {
        responseType: "stream",
      });
      const stream = response.data;
      
      // Logic for sending
      if (sendAsDocument || size > MAX_INLINE_VIDEO_SIZE) {
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
      } else {
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
      }
    } catch (err) {
      console.error("Error during download/send:", err);
      reply("❌ Failed to send the video. The download link from the scraper may have expired or the stream was interrupted.");
    } finally {
      delete sessions[from]; // Clean up session
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
