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
    react: "📽️",
    desc: "Download YouTube Video 🎬",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🎬 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් දාන්න!*");

      let videoUrl = "";
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
      } else {
        const search = await yts(q);
        const result = search.videos?.[0];
        if (!result) return reply("❌ වීඩියෝවක් හමු නොවීය. වෙනත් නමක් උත්සහ කරන්න.");
        videoUrl = result.url;
      }

      const res = await axios.get(`https://youtube-video-api.vercel.app/api/info?url=${videoUrl}`);
      const video = res.data;

      // Check for format safety
      if (!video?.formats || video.formats.length === 0) {
        return reply("❌ Failed to get video formats. Try another video.");
      }

      const format = video.formats.find(f => f.url && f.mimeType?.includes("video/mp4")) || video.formats[0];

      const caption = `
🎞️ *SENAL MD - Video Downloader*

🎧 *Title:* ${video.title}
⏱️ *Duration:* ${video.duration || "Unknown"}
📦 *Size:* ${format.size || "Unknown"}
👀 *Views:* ${video.views || "Unknown"}
📅 *Uploaded:* ${video.uploaded || "Unknown"}
🔗 *URL:* ${videoUrl}

📩 *Reply with:* 
1️⃣ = Send as Video  
2️⃣ = Send as Document

╰─ _𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇_
      `;

      // Send thumbnail + caption
      await robin.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption },
        { quoted: mek }
      );

      // Await user choice
      const choice = await new Promise((resolve) => {
        const handler = (msg) => {
          const content = msg.message?.conversation?.trim();
          if (msg.key.remoteJid === from && (content === "1" || content === "2")) {
            robin.off("messages.upsert", handler);
            resolve(content);
          }
        };
        robin.on("messages.upsert", handler);
        setTimeout(() => {
          robin.off("messages.upsert", handler);
          resolve(null);
        }, 30000);
      });

      if (!choice) return reply("❌ *Time out or invalid reply. Please send 1 or 2 within 30s.*");

      await reply("📤 *Uploading Video... Please wait!*");

      if (choice === "1") {
        await robin.sendMessage(from, {
          video: { url: format.url },
          mimetype: "video/mp4",
          caption: `🎬 ${video.title}`,
        }, { quoted: mek });
      } else if (choice === "2") {
        await robin.sendMessage(from, {
          document: { url: format.url },
          fileName: `${video.title}.mp4`,
          mimetype: "video/mp4",
          caption: "📂 *Here is your file!*",
        }, { quoted: mek });
      }

      return reply("✅ *Successfully Sent!* 🎉");

    } catch (e) {
      console.error("YT VIDEO ERROR:", e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
