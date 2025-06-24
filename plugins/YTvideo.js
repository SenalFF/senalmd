const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

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
      if (!q) return reply("🎬 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් දාන්න!*");

      let videoUrl = "";
      let videoInfo = {};
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
      } else {
        const search = await yts(q);
        const result = search.videos[0];
        if (!result) return reply("❌ වීඩියෝවක් හමු නොවීය. වෙනත් නමක් දාන්න.");
        videoUrl = result.url;
      }

      const res = await axios.get(`https://youtube-video-api.vercel.app/api/info?url=${videoUrl}`);
      if (!res.data || res.data.error) return reply("❌ Video data not found or blocked!");

      const video = res.data;
      const caption = `
🎞️ *SENAL MD - Video Downloader*

🎧 *Title:* ${video.title}
⏱️ *Duration:* ${video.duration}
📥 *Size:* ${video.formats[0].size}
👀 *Views:* ${video.views}
📅 *Uploaded:* ${video.uploaded}
🔗 *URL:* ${videoUrl}

🧩 *Reply with:* 
1️⃣ = Send as Video  
2️⃣ = Send as Document

╰─ _𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇_
      `;

      await robin.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption },
        { quoted: mek }
      );

      // Await reply
      const filter = (msg) => msg.key.remoteJid === from && msg.message?.conversation;
      const collected = await robin.awaitMessages(filter, { max: 1, time: 30000 });

      const choice = collected?.messages?.[0]?.message?.conversation?.trim();

      if (choice !== "1" && choice !== "2") return reply("❌ *Invalid choice. Please reply with 1 or 2.*");

      await reply("📤 *Video Uploading... Please wait* ⚙️");

      const sendOptions = {
        mimetype: "video/mp4",
        caption: `🎬 ${video.title}`,
        quoted: mek,
      };

      if (choice === "1") {
        await robin.sendMessage(from, { video: { url: video.formats[0].url }, ...sendOptions });
      } else {
        await robin.sendMessage(from, {
          document: { url: video.formats[0].url },
          fileName: `${video.title}.mp4`,
          mimetype: "video/mp4",
          caption: "🎞️ *SENAL MD Bot - Your Video is Ready!*",
        }, { quoted: mek });
      }

      return reply("✅ *Successfully Sent!* 🎉");
    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
