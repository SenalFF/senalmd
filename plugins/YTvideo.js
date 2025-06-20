const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("ruhend-scraper");

cmd(
  {
    pattern: "video",
    react: "🎵",
    desc: "Download YouTube Video",
    category: "download",
    filename: __filename,
  },
  async (
    robin,
    mek,
    m,
    {
      from,
      q,
      reply,
    }
  ) => {
    try {
      if (!q) return reply("*නමක් හරි ලින්ක් එකක් හරි දෙන්න* 🌚❤️");

      // Search YouTube using yts
      const search = await yts(q);
      const video = search.videos[0];
      const url = video.url;

      // Video details
      const desc = `
*❤️ SENAL MD Video Downloader 😚*

👻 *Title*       : ${video.title}
👻 *Description* : ${video.description}
👻 *Duration*    : ${video.timestamp}
👻 *Views*       : ${video.views}
👻 *Uploaded*    : ${video.ago}
👻 *URL*         : ${url}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇
`;

      // Send thumbnail and info
      await robin.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption: desc },
        { quoted: mek }
      );

      // Duration check (limit to 30 minutes)
      let [min, sec] = video.timestamp.split(":").map(Number);
      let totalSeconds = min * 60 + sec;
      if (totalSeconds > 1800) return reply("⏱️ Video limit is 30 minutes");

      // Download video with ruhend-scraper
      const { title, audio, video: videoUrl, thumbnail } = await ytmp4(url);

      // Send video file
      await robin.sendMessage(
        from,
        {
          video: { url: videoUrl },
          mimetype: "video/mp4",
          caption: `🎬 ${title}`,
        },
        { quoted: mek }
      );

      // Send as document
      await robin.sendMessage(
        from,
        {
          document: { url: videoUrl },
          mimetype: "video/mp4",
          fileName: `${title}.mp4`,
          caption: "𝐌𝐚𝐝𝐞 𝐛𝐲 𝙎𝙀𝙉𝘼𝙇",
        },
        { quoted: mek }
      );

      return reply("*✅ Video sent successfully!* 🌚❤️");

    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
