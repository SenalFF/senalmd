const { cmd } = require("../command");
const yts = require("yt-search");
const fs = require("fs");
const ytdl = require("ytdl-core");

function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

cmd(
  {
    pattern: "video",
    react: "🎥",
    desc: "Download YouTube Video",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("*නමක් හරි ලින්ක් එකක් හරි දෙන්න* 🌚❤️");

      let videoUrl = "";
      let info;

      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
        info = await ytdl.getInfo(videoUrl);
      } else {
        const search = await yts(q);
        const result = search.videos[0];
        if (!result) return reply("❌ Video not found, try another name.");

        videoUrl = result.url;
        info = await ytdl.getInfo(videoUrl);
      }

      const title = info.videoDetails.title;
      const durationSeconds = parseInt(info.videoDetails.lengthSeconds, 10);
      if (durationSeconds > 1800) return reply("⏱️ Video limit is 30 minutes!");

      const views = info.videoDetails.viewCount;
      const upload = info.videoDetails.publishDate;
      const thumbnail = info.videoDetails.thumbnails.pop().url;

      const caption = `
*❤️ SENAL MD Video Downloader 😚*

👑 *Title*     : ${title}
⏱️ *Duration*  : ${Math.floor(durationSeconds / 60)}:${durationSeconds % 60}
👀 *Views*     : ${views}
📤 *Uploaded*  : ${upload}
🔗 *URL*       : ${videoUrl}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇
`;

      await robin.sendMessage(from, { image: { url: thumbnail }, caption }, { quoted: mek });

      const stream = ytdl(videoUrl, { quality: "18" });
      const tmpFile = `/tmp/${Date.now()}.mp4`;
      const file = fs.createWriteStream(tmpFile);

      stream.pipe(file);

      file.on("finish", async () => {
        await robin.sendMessage(
          from,
          {
            video: { url: tmpFile },
            mimetype: "video/mp4",
            caption: `🎬 ${title}`,
          },
          { quoted: mek }
        );

        await robin.sendMessage(
          from,
          {
            document: { url: tmpFile },
            mimetype: "video/mp4",
            fileName: `${title}.mp4`,
            caption: "𝐌𝐚𝐝𝐞 𝐛𝐲 𝙎𝙀𝙉𝘼𝙇",
          },
          { quoted: mek }
        );

        return reply("*✅ Video sent successfully!* 🌚❤️");
      });

      stream.on("error", (err) => {
        console.error(err);
        return reply(`❌ Error: ${err.message}`);
      });
    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
