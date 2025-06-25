const { cmd } = require("../command");
const yts = require("yt-search");
const youtubedl = require("youtube-dl-exec");
const axios = require("axios");

// ✅ Normalize YouTube URL
function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

// ✅ Convert bytes to MB
function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

// ✅ Main song downloader
cmd(
  {
    pattern: "play",
    react: "🎵",
    desc: "Download YouTube MP3",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 නමක් හෝ යූඇර්එල් එකක් දෙන්න!");

      let videoUrl = "";
      let videoInfo = null;

      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
      } else {
        const search = await yts(q);
        if (!search.videos.length) return reply("❌ ගීතය හමු නොවුණා.");
        const video = search.videos[0];
        videoUrl = video.url;
        videoInfo = {
          title: video.title,
          duration: video.timestamp,
          views: video.views,
          upload: video.ago,
          thumbnail: video.thumbnail,
        };
      }

      // ✅ If direct URL but no info yet
      if (!videoInfo) {
        const id = normalizeYouTubeUrl(videoUrl).split("v=")[1];
        const info = await yts({ videoId: id });
        videoInfo = {
          title: info.title,
          duration: info.timestamp,
          views: info.views,
          upload: info.ago,
          thumbnail: info.thumbnail,
        };
      }

      // ✅ Get downloadable MP3 URL
      const result = await youtubedl(videoUrl, {
        extractAudio: true,
        audioFormat: "mp3",
        getUrl: true,
      });

      // ✅ Get file size via HEAD request
      let sizeText = "Unknown";
      try {
        const head = await axios.head(result);
        if (head.headers["content-length"]) {
          sizeText = formatBytes(parseInt(head.headers["content-length"]));
        }
      } catch (e) {
        console.warn("⚠️ Couldn't fetch file size.");
      }

      const caption = `
🎶 *SENAL MD Song Downloader*

🎧 *Title*     : ${videoInfo.title}
⏱️ *Duration*  : ${videoInfo.duration}
📁 *Size*      : ${sizeText}
👁️ *Views*     : ${videoInfo.views}
📤 *Uploaded*  : ${videoInfo.upload}
🔗 *URL*       : ${videoUrl}

_❤️ Made by 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇_
`;

      // ✅ Send video details and thumbnail
      await robin.sendMessage(
        from,
        {
          image: { url: videoInfo.thumbnail },
          caption,
        },
        { quoted: mek }
      );

      // ✅ Send MP3 as document
      await robin.sendMessage(
        from,
        {
          document: { url: result },
          mimetype: "audio/mpeg",
          fileName: `${videoInfo.title}.mp3`,
          caption: "📥 *Download Completed*\n🎵 Enjoy your song!",
        },
        { quoted: mek }
      );

      return reply("✅ *MP3 file sent successfully!* 🎶");
    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
