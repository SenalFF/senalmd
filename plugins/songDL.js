const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");
const { ytmp3 } = require("@kelvdra/scraper");

// Format bytes into MB/KB
function formatBytes(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) return "0 Byte";
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// Normalize any YouTube URL to standard form
function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

cmd(
  {
    pattern: "song",
    react: "🎵",
    desc: "Download YouTube audio as MP3",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("*නමක් හරි ලින්ක් එකක් හරි දෙන්න* 🎧❤️");

      let videoUrl = "";
      let audioInfo = {};
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
        audioInfo = await ytmp3(videoUrl, "mp3");
      } else {
        const search = await yts(q);
        const result = search.videos[0];
        if (!result) return reply("❌ ගීතය හමු නොවුණා, වෙනත් නමක් හොයා බලන්න.");
        videoUrl = result.url;
        audioInfo = await ytmp3(videoUrl, "mp3");
      }

      if (!audioInfo.audio || typeof audioInfo.audio !== "string") {
        return reply("❌ ගීතය ලබාගැනීමට බැරි වුණා, වෙනත් එකක් හොයා බලන්න.");
      }

      // Download audio buffer
      const audioRes = await axios.get(audioInfo.audio, {
        responseType: "arraybuffer",
      });
      const audioBuffer = Buffer.from(audioRes.data);
      const audioSize = formatBytes(audioBuffer.length);

      // 🎯 First: Send Thumbnail + Info (with file size)
      const infoCaption = `
*🎶 SENAL MD Song Downloader ❤️*

🎵 *Title*     : ${audioInfo.title}
🎧 *Quality*   : ${audioInfo.quality || "mp3"}
📁 *File Size* : ${audioSize}
📤 *Uploaded*  : ${audioInfo.upload || "N/A"}
🔗 *URL*       : ${videoUrl}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇 🎧
      `;

      await robin.sendMessage(
        from,
        {
          image: { url: audioInfo.thumbnail },
          caption: infoCaption,
        },
        { quoted: mek }
      );

      // 🎧 Then: Send as MP3 (audio message)
      await robin.sendMessage(
        from,
        {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          ptt: false,
          fileName: `${audioInfo.title || "song"}.mp3`,
        },
        { quoted: mek }
      );

      // 📄 Then: Send as Document
      await robin.sendMessage(
        from,
        {
          document: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${audioInfo.title || "song"}.mp3`,
          caption: "📝 Document Type - Made by MR SENAL 🎧",
        },
        { quoted: mek }
      );

      return reply("*✅ Song sent as audio and document!*");
    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
