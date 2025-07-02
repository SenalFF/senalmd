const { cmd } = require("../command");
const yts = require("yt-search");
const { getDownloadDetails } = require("youtube-downloader-cc-api");

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
      if (!q) return reply("*🔍 නමක් හරි ලින්ක් එකක් හරි දෙන්න*");

      const search = await yts(q);
      const video = search.videos[0];
      if (!video) return reply("❌ ගීතය හමු නොවීය. වෙනත් වචනයක් උත්සාහ කරන්න.");

      const videoUrl = video.url;

      // Fetch audio download details using youtube-downloader-cc-api
      const response = await getDownloadDetails(videoUrl, "mp3", "stream");

      const caption = `
*❤️ SENAL MD Song Downloader 😍*

🎶 *Title*     : ${video.title}
⏱️ *Duration*  : ${video.timestamp}
👁️ *Views*     : ${video.views}
📤 *Uploaded*  : ${video.ago}
🔗 *URL*       : ${videoUrl}

🔊 *Type:* Audio (.mp3)

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇
`;

      // 🖼 Thumbnail + Info
      await robin.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption },
        { quoted: mek }
      );

      // 🎧 Send Audio
      await robin.sendMessage(
        from,
        {
          audio: { url: response.download },
          mimetype: "audio/mpeg",
          fileName: `${video.title}.mp3`,
        },
        { quoted: mek }
      );

      return reply("*✅ Song sent successfully!*");
    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
