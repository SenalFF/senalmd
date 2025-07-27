// project/plugin/videodl.js

const { cmd } = require("../command"); // Assuming your command handler is here
const yts = require("yt-search");
const ytdl = require("@distube/ytdl-core"); // Use the maintained fork

// --- Configuration ---
// WhatsApp's official limit for documents is 2GB
const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024 * 1024;
// A safe limit for sending as a 'video' message type (~64MB is a safe bet)
const MAX_INLINE_VIDEO_SIZE = 64 * 1024 * 1024;

// Session management to keep track of user choices
const sessions = {};

/**
 * A utility to format bytes into a human-readable string.
 * @param {number} bytes - The number of bytes.
 * @returns {string} A formatted string (e.g., "150.5 MB").
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
    if (!q) return reply("🔍 Please provide a video name or YouTube link to search.");

    const from = mek.key.remoteJid;

    try {
      await reply("🔎 Searching for the video on YouTube...");
      
      let videoInfo;
      // Check if the query is a valid YouTube URL
      if (ytdl.validateURL(q)) {
        videoInfo = await ytdl.getInfo(q);
      } else {
        // If not a URL, search on YouTube
        const searchResults = await yts(q);
        if (!searchResults.videos.length) return reply("❌ No video found for your query.");
        videoInfo = await ytdl.getInfo(searchResults.videos[0].url);
      }
      
      const { videoDetails } = videoInfo;

      // Find the best MP4 format under 2GB with both video and audio
      const format = ytdl.chooseFormat(videoInfo.formats, {
        quality: 'highest',
        filter: (f) => 
            f.container === 'mp4' && 
            f.hasVideo && 
            f.hasAudio &&
            Number(f.contentLength || 0) < MAX_DOCUMENT_SIZE,
      });

      if (!format) {
        return reply("❌ Couldn't find a suitable video format to download (under 2GB with audio).");
      }
      
      const size = format.contentLength ? formatBytes(format.contentLength) : "Unknown";

      // Store the video info and chosen format in the session
      sessions[from] = {
        videoUrl: videoDetails.video_url,
        title: videoDetails.title,
        format: format, // Store the entire format object
        step: "choose_format",
      };

      const infoCaption = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${videoDetails.title}
⏱️ *Duration:* ${new Date(videoDetails.lengthSeconds * 1000).toISOString().substr(11, 8)}
👁️ *Views:* ${Number(videoDetails.viewCount).toLocaleString()}
✅ *Quality:* ${format.qualityLabel || 'Unknown'} (${format.container})
📦 *Size:* ${size}
🔗 *URL:* ${videoDetails.video_url}

*Reply with one of the following commands:*
🔹 Reply with *vid1* - Send as a standard video (if under 64MB)
🔹 Reply with *vid2* - Send as a document file
`;

      await robin.sendMessage(
        from,
        {
          image: { url: videoDetails.thumbnails[videoDetails.thumbnails.length - 1].url },
          caption: infoCaption,
        },
        { quoted: mek }
      );

    } catch (err) {
      console.error("Error in .vid command:", err);
      reply("❌ An error occurred. It might be an age-restricted video, a private video, or a network issue. Please try again.");
    }
  }
);


/**
 * The core function to handle the download and sending process.
 * @param {boolean} sendAsDocument - If true, forces sending as a document.
 */
async function handleDownload(robin, mek, m, { reply }, sendAsDocument = false) {
    const from = mek.key.remoteJid;
    const session = sessions[from];

    if (!session || session.step !== "choose_format") {
        return reply("Please search for a video with the `.vid` command first.");
    }
    
    // Prevent multiple triggers
    session.step = "sending";

    try {
        const { videoUrl, title, format } = session;
        const size = Number(format.contentLength);
        const sizeFormatted = formatBytes(size);

        await reply(`✅ Preparing your video...\n*Title:* ${title}\n*Size:* ${sizeFormatted}`);

        // Create a readable stream from ytdl-core.
        // It does not require any additional options like 'highWaterMark' for this use case,
        // as the backpressure is handled between the source (ytdl) and destination (WhatsApp send).
        const stream = ytdl(videoUrl, { format });

        // Logic for sending
        if (sendAsDocument || size > MAX_INLINE_VIDEO_SIZE) {
            await reply("📡 Streaming video as a document file. Please wait, this may take a while for large files...");
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
        reply("❌ Failed to send the video. The stream may have been interrupted or the video might be inaccessible.");
    } finally {
        // Clean up the session to free up memory
        delete sessions[from];
    }
}


// --- Command to download as Video (vid1) ---
cmd(
  {
    pattern: "vid1",
    desc: "Send YouTube video (uses the result from .vid).",
    dontAddCommandList: true,
  },
  (robin, mek, m, args) => handleDownload(robin, mek, m, args, false)
);


// --- Command to download as Document (vid2) ---
cmd(
  {
    pattern: "vid2",
    desc: "Send YouTube video as a document (uses the result from .vid).",
    dontAddCommandList: true,
  },
  (robin, mek, m, args) => handleDownload(robin, mek, m, args, true)
);
