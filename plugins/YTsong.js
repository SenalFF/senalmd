const { cmd } = require("../command");
const yts = require("yt-search");
const svdl = require("@blackamda/song_video_dl")

// ✅ Normalize YouTube URL
function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

cmd(
  {
    pattern: "play",
    react: "🎧",
    desc: "Download YouTube Music Audio",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("*නමක් හරි ලින්ක් එකක් හරි දෙන්න* 🌚❤️");

      let videoUrl = "";
      let audioInfo = {};
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
      } else {
        const search = await yts(q);
        const result = search.videos[0];
        if (!result) return reply("❌ Song not found, try another keyword.");
        videoUrl = result.url;
      }

      // 🔽 Download Audio (MP3)
      audioInfo = await ytmp3(videoUrl, 'mp3');

      const caption = `
*❤️ SENAL MD Song Downloader 😍*

🎶 *Title*     : ${audioInfo.title}
⏱️ *Duration*  : ${audioInfo.duration}
🎧 *Quality*   : MP3
📤 *Uploaded*  : ${audioInfo.uploadDate}
🔗 *URL*       : ${videoUrl}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇
`;

      // 🖼 Thumbnail + Info
      await robin.sendMessage(
        from,
        { image: { url: audioInfo.thumbnail }, caption },
        { quoted: mek }
      );

      // 🎵 Send Audio
      await robin.sendMessage(
        from,
        {
          audio: { url: audioInfo.audio },
          mimetype: "audio/mpeg",
          fileName: `${audioInfo.title}.mp3`,
        },
        { quoted: mek }
      );

      // 📄 Send as Document
      await robin.sendMessage(
        from,
        {
          document: { url: audioInfo.audio },
          mimetype: "audio/mpeg",
          fileName: `${audioInfo.title}.mp3`,
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
