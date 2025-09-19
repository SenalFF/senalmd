// play2.js - YouTube Audio Downloader Plugin
const { cmd } = require("../command");
const yts = require("yt-search");
const youtubedl = require("youtube-dl-exec");
const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

// In-memory storage for audio tokens
const downloadTokens = new Map();

// Clean up expired tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of downloadTokens.entries()) {
    if (now - data.timestamp > 600000) downloadTokens.delete(token);
  }
}, 600000);

// ------------------------
// Helper: Search YouTube
// ------------------------
async function searchYouTube(query) {
  const result = await yts(query);
  if (!result || !result.videos || result.videos.length === 0) return null;
  return result.videos[0];
}

// ------------------------
// Helper: Get audio info via yt-dlp
// ------------------------
async function getAudioInfo(url) {
  const info = await youtubedl(url, {
    dumpSingleJson: true,
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: true,
    youtubeSkipDashManifest: true,
    format: "bestaudio[ext=m4a]/bestaudio"
  });

  const audioFormat = info.formats.find(f => f.url && f.acodec !== "none");
  if (!audioFormat) throw new Error("No valid audio format found");

  return {
    title: info.title,
    duration: info.duration,
    uploader: info.uploader,
    url: audioFormat.url,
    format: audioFormat.ext,
    thumbnail: info.thumbnails?.[0]?.url || null
  };
}

// ------------------------
// Helper: Store token
// ------------------------
function storeToken(audio) {
  const token = uuidv4().substring(0, 8);
  downloadTokens.set(token, { audio, timestamp: Date.now() });
  return token;
}

// ------------------------
// Main play2 command
// ------------------------
cmd(
  {
    pattern: "play2",
    desc: "🎧 Download YouTube Audio",
    category: "download",
    react: "🎵"
  },
  async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply("❌ Please provide a YouTube link or song name.");

    try {
      let videoUrl;

      if (q.startsWith("http")) {
        videoUrl = q;
      } else {
        const search = await searchYouTube(q);
        if (!search) return reply("❌ No results found.");
        videoUrl = search.url;
      }

      const audio = await getAudioInfo(videoUrl);
      const token = storeToken(audio);

      const buttons = [
        { buttonId: `playaudio_${token}`, buttonText: { displayText: "🎶 Play Audio" }, type: 1 },
        { buttonId: `playdoc_${token}`, buttonText: { displayText: "📄 Document" }, type: 1 },
        { buttonId: `playvoice_${token}`, buttonText: { displayText: "🎤 Voice Note" }, type: 1 }
      ];

      const buttonMessage = {
        text: `🎵 *${audio.title}*\n👤 ${audio.uploader}\n⏱ Duration: ${Math.floor(audio.duration / 60)}:${String(audio.duration % 60).padStart(2, "0")} min`,
        footer: "@mr senal",
        buttons,
        headerType: 4,
        contextInfo: {
          externalAdReply: {
            title: audio.title,
            body: `By ${audio.uploader}`,
            thumbnailUrl: audio.thumbnail,
            mediaType: 2,
            sourceUrl: videoUrl
          }
        }
      };

      await conn.sendMessage(from, buttonMessage);

    } catch (err) {
      console.error("❌ play2 error:", err);
      reply("❌ An error occurred while processing the song. Please try again later.");
    }
  }
);

// ------------------------
// Button Handlers
// ------------------------
cmd(
  { pattern: "playaudio_|playdoc_|playvoice_", onlyButton: true },
  async (conn, mek, m, { from, text }) => {
    try {
      const [command, token] = text.split("_");
      const tokenData = downloadTokens.get(token);

      if (!tokenData) {
        return await conn.sendMessage(
          from,
          { text: "❌ Download token expired. Please request the song again." },
          { quoted: mek }
        );
      }

      const audio = tokenData.audio;
      const tempFile = path.join(os.tmpdir(), `${audio.title}.${audio.format}`);

      // Download the file only if it doesn't exist
      if (!fs.existsSync(tempFile)) {
        const writer = fs.createWriteStream(tempFile);
        const response = await axios({ url: audio.url, method: "GET", responseType: "stream" });
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });
      }

      // Send the file based on button type
      if (command === "playaudio") {
        await conn.sendMessage(from, {
          audio: fs.createReadStream(tempFile),
          mimetype: audio.format === "m4a" ? "audio/mp4" : "audio/mpeg",
          fileName: `${audio.title}.${audio.format}`
        });
      } else if (command === "playdoc") {
        await conn.sendMessage(from, {
          document: fs.createReadStream(tempFile),
          mimetype: audio.format === "m4a" ? "audio/mp4" : "audio/mpeg",
          fileName: `${audio.title}.${audio.format}`
        });
      } else if (command === "playvoice") {
        await conn.sendMessage(from, {
          audio: fs.createReadStream(tempFile),
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        });
      }

      // Delete token after use
      downloadTokens.delete(token);

      // Optional: keep temp file cached for reuse, delete manually if needed
      // fs.unlinkSync(tempFile);

    } catch (err) {
      console.error("❌ buttonHandler error:", err);
      await conn.sendMessage(from, { text: "❌ Failed to download or send the audio." });
    }
  }
);
