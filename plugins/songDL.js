const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("ruhend-scraper");

// ✅ Normalize YouTube URL (if user provides link)
function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

cmd(
  {
    pattern: "song",
    react: "🎧",
    desc: "Download YouTube Song (MP3)",
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
      if (!q) return reply("*ගීතයේ නමක් හරි ලින්ක් එකක් හරි දෙන්න* 🎧❤️");

      let audioUrl = "";
      let audioInfo = {};
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        audioUrl = normalizedUrl;
        audioInfo = await ytmp3(audioUrl);
      } else {
        // If not a link, search YouTube
        const search = await yts(q);
        const result = search.videos[0];
        if (!result) return reply("❌ ගීතය හමු නොවුණා, වෙනත් නමක් දාන්න!");

        audioUrl = result.url;
        audioInfo = await ytmp3(audioUrl);
      }

      const caption = `
*🎶 SENAL MD Song Downloader 😎*

👑 *Title*     : ${audioInfo.title}
⏱️ *Duration*  : ${audioInfo.duration}
👀 *Views*     : ${audioInfo.views}
📤 *Uploaded*  : ${audioInfo.upload}
🔗 *URL*       : ${audioUrl}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇
`;

      // 🖼️ Send thumbnail with info
      await robin.sendMessage(
        from,
        { image: { url: audioInfo.thumbnail }, caption },
        { quoted: mek }
      );

      // 🔊 Send audio
      await robin.sendMessage(
        from,
        {
          audio: { url: audioInfo.audio },
          mimetype: "audio/mp4",
          ptt: false,
        },
        { quoted: mek }
      );

      // 📁 Send as document
      await robin.sendMessage(
        from,
        {
          document: { url: audioInfo.audio },
          mimetype: "audio/mp3",
          fileName: `${audioInfo.title}.mp3`,
          caption: "🎵 𝐒𝐨𝐧𝐠 𝐁𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇 🎵",
        },
        { quoted: mek }
      );

      return reply("*✅ Song sent successfully as audio and document!* 🎧");
    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
