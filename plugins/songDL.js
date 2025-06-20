const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("ruhend-scraper");
const axios = require("axios");

// 🔁 Normalize YouTube URL (supports full, short, shorts links)
function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

// 📏 Convert bytes to readable size
function formatSize(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) return "0 Byte";
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
}

cmd(
  {
    pattern: "play",
    react: "🎧",
    desc: "Download YouTube Song as Audio",
    category: "download",
    filename: __filename,
  },
  async (
    robin,
    mek,
    m,
    { from, q, reply }
  ) => {
    try {
      if (!q) return reply("*📌 Please provide a song name or YouTube link.* 🎶");

      let audioUrl = "";
      let audioInfo = {};
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        audioUrl = normalizedUrl;
        audioInfo = await ytmp3(audioUrl);
      } else {
        const search = await yts(q);
        const result = search.videos[0];
        if (!result) return reply("❌ Song not found. Please try another name.");

        audioUrl = result.url;
        audioInfo = await ytmp3(audioUrl);
      }

      if (!audioInfo.audio || !audioInfo.title) {
        return reply("❌ Error: Song not available.");
      }

      // 📦 Check file size (16MB = 16 * 1024 * 1024 = 16,777,216 bytes)
      let fileSize = 0;
      try {
        const { headers } = await axios.head(audioInfo.audio);
        fileSize = parseInt(headers["content-length"] || "0");
      } catch {
        // If HEAD request fails, assume too large
        fileSize = 17 * 1024 * 1024;
      }

      const caption = `
*🎧 SENAL MD Song Downloader 🎧*

🎵 *Title*     : ${audioInfo.title}
🕒 *Duration*  : ${audioInfo.duration}
👁️ *Views*     : ${audioInfo.views}
📆 *Uploaded*  : ${audioInfo.upload}
📦 *Size*      : ${formatSize(fileSize)}
🔗 *URL*       : ${audioUrl}

ᴹᴿ ˢᴱᴺᴬᴸ ʙᴏᴛ ʙʏ 🇱🇰
`;

      await robin.sendMessage(
        from,
        { image: { url: audioInfo.thumbnail }, caption },
        { quoted: mek }
      );

      // ⛔ Large file: skip audio upload, send only document or link
      if (fileSize > 16 * 1024 * 1024) {
        await robin.sendMessage(
          from,
          {
            document: { url: audioInfo.audio },
            mimetype: "audio/mpeg",
            fileName: `${audioInfo.title}.mp3`,
            caption: "*📁 MP3 file is large, sent as document.*",
          },
          { quoted: mek }
        );
        await reply("⚠️ *Audio is too large for direct play (over 16MB). Download as document above.*");
      } else {
        // ✅ Small file: send audio normally
        await robin.sendMessage(
          from,
          {
            audio: { url: audioInfo.audio },
            mimetype: "audio/mpeg",
            ptt: false,
          },
          { quoted: mek }
        );
        await reply("🎶 *Audio uploaded successfully!*");
      }

    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
