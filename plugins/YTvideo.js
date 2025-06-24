const fetch = require("node-fetch");
global.fetch = (url, options = {}) => {
  options.headers = {
    ...(options.headers || {}),
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 Chrome/89.0.4389.90 Mobile Safari/537.36",
  };
  return require("node-fetch")(url, options);
};

const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("ruhend-scraper");

// ✅ Normalize YouTube URL
function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

// ✅ Command: .video
cmd(
  {
    pattern: "video",
    react: "🎥",
    desc: "YouTube වීඩියෝ එකක් ඩවුන්ලෝඩ් කරන්න",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply, react, setReply }) => {
    try {
      if (!q) return reply("❗ *නමක් හරි ලින්ක් එකක් හරි දෙන්න* 🌚❤️");

      let videoUrl = "";
      let videoInfo = {};
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
        videoInfo = await ytmp4(videoUrl);
      } else {
        const search = await yts(q);
        const result = search.videos[0];
        if (!result) return reply("❌ Video එක හමු නොවීය, වෙනත් නමක් try කරන්න.");

        videoUrl = result.url;
        videoInfo = await ytmp4(videoUrl);
      }

      // Duration check (max 30 minutes)
      const [min, sec = 0] = videoInfo.duration.split(":").map(Number);
      const totalSeconds = min * 60 + sec;
      if (totalSeconds > 1800) return reply("⏱️ වීඩියෝ එකේ දීර්ඝතාවය 30 minutes ඉක්මවන්නේ නැහැ!");

      const caption = `
✨ *❤️ SENAL MD YouTube Video Downloader* ✨

👑 *Title*     : ${videoInfo.title}
⏱️ *Duration*  : ${videoInfo.duration}
👀 *Views*     : ${videoInfo.views}
📤 *Uploaded*  : ${videoInfo.upload}
🔗 *URL*       : ${videoUrl}

📌 *Reply with:* 
1️⃣ - 🎬 *Video* (Mp4)
2️⃣ - 📦 *Document* (Mp4)

⚡ 𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇 ⚡
`;

      // Send video thumbnail and details
      await robin.sendMessage(
        from,
        { image: { url: videoInfo.thumbnail }, caption },
        { quoted: mek }
      );

      // Wait for reply (1 or 2)
      setReply(mek.key.id, async (msg) => {
        const userReply = msg.body.trim();

        if (userReply !== "1" && userReply !== "2")
          return reply("❌ *වැරදි option එකක්* 🙅‍♂️. කරුණාකර 1 හෝ 2 යොදන්න.");

        // Send uploading message
        await reply("⏳ *Uploading your video...* 🔄🎥");

        if (userReply === "1") {
          // Send as video
          await robin.sendMessage(
            from,
            {
              video: { url: videoInfo.video },
              mimetype: "video/mp4",
              caption: `🎬 *${videoInfo.title}*`,
            },
            { quoted: mek }
          );
        } else if (userReply === "2") {
          // Send as document
          await robin.sendMessage(
            from,
            {
              document: { url: videoInfo.video },
              mimetype: "video/mp4",
              fileName: `${videoInfo.title}.mp4`,
              caption: "📦 *Sent as document by SENAL MD Bot*",
            },
            { quoted: mek }
          );
        }

        // Final confirmation message
        await reply("✅ *Video Upload complete!* 🎉\n\n🔥 *Uploaded by Senal MD Bot* 🔥");
      });
    } catch (e) {
      console.error(e);
      return reply(`❌ *Error:* ${e.message}`);
    }
  }
);
