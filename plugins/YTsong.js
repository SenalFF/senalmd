const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper");

// ✅ YouTube URL normalizer
function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

cmd(
  {
    pattern: "ytmp3", // You can rename to 'song' if needed
    react: "🎧",
    desc: "Download YouTube MP3 Audio",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("*නමක් හරි ලින්ක් එකක් හරි දෙන්න* 🌚❤️");

      // Check and normalize YouTube URL
      let videoUrl = "";
      let videoInfo = {};
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
        videoInfo = await ytmp3(videoUrl);
      } else {
        // Search by query
        const search = await yts(q);
        const result = search.videos[0];
        if (!result) return reply("❌ Video not found, try another name.");

        videoUrl = result.url;
        videoInfo = await ytmp3(videoUrl);
      }

      // Duration limit
      const [min, sec = 0] = videoInfo.duration.split(":").map(Number);
      const totalSeconds = min * 60 + sec;
      if (totalSeconds > 1800) return reply("⏱️ Audio limit is 30 minutes!");

      const caption = `
*❤️ SENAL MD MP3 Downloader 🎧*

👑 *Title*     : ${videoInfo.title}
⏱️ *Duration*  : ${videoInfo.duration}
👀 *Views*     : ${videoInfo.views}
📤 *Uploaded*  : ${videoInfo.upload}
🔗 *URL*       : ${videoUrl}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇
`;

      // Send thumbnail with info
      await robin.sendMessage(
        from,
        { image: { url: videoInfo.thumbnail }, caption },
        { quoted: mek }
      );

      // Send as document (MP3)
      await robin.sendMessage(
        from,
        {
          document: { url: videoInfo.audio },
          mimetype: "audio/mpeg",
          fileName: `${videoInfo.title}.mp3`,
          caption: "🎵 *Here is your MP3!*",
        },
        { quoted: mek }
      );

      return reply("*✅ MP3 sent successfully as document!* 🌚❤️");
    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
