const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@vreden/youtube_scraper");

cmd(
  {
    pattern: "video",
    react: "🎬",
    desc: "Download YouTube Video",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { q, from, reply }) => {
    try {
      if (!q) return reply("*Give a video name or YouTube link* 🎥");

      const search = await yts(q);
      const data = search.videos[0];
      const url = data.url;

      const duration = data.seconds;
      if (duration > 1800) return reply("⏱️ Video limit is 30 minutes.");

      const video = await ytmp4(url, "360");

      const caption = `
*🎥 Title:* ${data.title}
*📆 Published:* ${data.ago}
*👁 Views:* ${data.views}
*🔗 URL:* ${url}

🎬 Powered by SENAL MD
`;

      await robin.sendMessage(
        from,
        { video: { url: video.download.url }, caption },
        { quoted: mek }
      );
    } catch (err) {
      console.log(err);
      reply("❌ Error downloading video.");
    }
  }
);
