const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper");

function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

cmd(
  {
    pattern: "song",
    react: "🎧",
    desc: "Download YouTube Music Audio",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("*නමක් හරි ලින්ක් එකක් හරි දෙන්න* 🌚❤️");

      let videoUrl = "";
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
      } else {
        const search = await yts(q);
        const result = search.videos?.[0];
        if (!result) return reply("❌ Song not found, try another keyword.");
        videoUrl = result.url;
      }

      const audioInfo = await ytmp3(videoUrl, 'mp3');

      if (!audioInfo || !audioInfo.audio) {
        return reply("❌ Failed to fetch audio data.");
      }

      const caption = `
*❤️ SENAL MD Song Downloader 😍*

🎶 *Title*     : ${audioInfo.title || "Unknown Title"}
⏱️ *Duration*  : ${audioInfo.duration || "N/A"}
🎧 *Quality*   : MP3
📤 *Uploaded*  : ${audioInfo.uploadDate || "Unknown"}
🔗 *URL*       : ${videoUrl}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇
`;

      // 🖼 Thumbnail + Info
      if (audioInfo.thumbnail) {
        await robin.sendMessage(
          from,
          { image: { url: audioInfo.thumbnail }, caption },
          { quoted: mek }
        );
      }

      // 🎵 Send Audio
      await robin.sendMessage(
        from,
        {
          audio: { url: audioInfo.audio },
          mimetype: "audio/mpeg",
          fileName: `${audioInfo.title || "song"}.mp3`,
        },
        { quoted: mek }
      );

      // 📄 Send as Document
      await robin.sendMessage(
        from,
        {
          document: { url: audioInfo.audio },
          mimetype: "audio/mpeg",
          fileName: `${audioInfo.title || "song"}.mp3`,
          caption: "𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇 🎧",
        },
        { quoted: mek }
      );

      return reply("*✅ Song sent as audio and document!* 🌚❤️");
    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
