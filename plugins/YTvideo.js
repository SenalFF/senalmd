const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@vreden/youtube_scraper");

cmd(
  {
    pattern: "video",
    react: "🎬",
    desc: "Download YouTube video",
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
      if (!q) return reply("*Video name එකක් හරි link එකක් හරි දාන්න බ්‍රෝ* 🎬");

      const search = await yts(q);
      const data = search.videos[0];
      const url = data.url;

      let desc = `
*🎬 SENAL MD VIDEO DOWNLOADER 😎*

👻 *title* : ${data.title}
👻 *description* : ${data.description}
👻 *time* : ${data.timestamp}
👻 *ago* : ${data.ago}
👻 *views* : ${data.views}
👻 *url* : ${data.url}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇
`;

      await robin.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      const videoData = await ytmp4(url);

      // Video duration check (max 30 minutes)
      let durationParts = data.timestamp.split(":").map(Number);
      let totalSeconds =
        durationParts.length === 3
          ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
          : durationParts[0] * 60 + durationParts[1];

      if (totalSeconds > 1800) {
        return reply("⏱️ Video limit is 30 minutes.");
      }

      // Send video as stream
      await robin.sendMessage(
        from,
        {
          video: { url: videoData.download.url },
          mimetype: "video/mp4",
          caption: `🎥 ${data.title}`,
        },
        { quoted: mek }
      );

      // Send video as document (optional)
      await robin.sendMessage(
        from,
        {
          document: { url: videoData.download.url },
          mimetype: "video/mp4",
          fileName: `${data.title}.mp4`,
          caption: "𝐌𝐚𝐝𝐞 𝐛𝐲 𝙎𝙀𝙉𝘼𝙇",
        },
        { quoted: mek }
      );

      return reply("*✅ Download complete* 🎬❤️");
    } catch (e) {
      console.error(e);
      reply(`❌ Error: ${e.message}`);
    }
  }
);
