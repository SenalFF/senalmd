const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("ruhend-scraper");

// 🛠 Dynamic import for fetch (ESM workaround)
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// 🎯 Normalize YouTube URL
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
  async (robin, mek, m, { from, q, reply, client }) => {
    try {
      if (!q) return reply("❌ *කරුණාකර නමක් හෝ YouTube ලින්ක් එකක් දෙන්න!*");

      // 🔍 Search or Normalize URL
      let videoUrl = "";
      let videoInfo = {};
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
        videoInfo = await ytmp4(videoUrl);
      } else {
        const search = await yts(q);
        const result = search.videos[0];
        if (!result) return reply("❌ *වීඩියෝවක් හමු නොවුණා. වෙනත් නමක් උත්සාහ කරන්න.*");
        videoUrl = result.url;
        videoInfo = await ytmp4(videoUrl);
      }

      // 📏 Fetch file size
      const res = await fetch(videoInfo.video);
      const sizeMB = res.headers.get("content-length")
        ? `${(parseInt(res.headers.get("content-length")) / 1048576).toFixed(2)} MB`
        : "Unknown";

      // 📋 Video Info Message
      const caption = `
🎬 *SENAL MD - Video Downloader*

🖼️ *Title:* ${videoInfo.title}
🕐 *Duration:* ${videoInfo.duration}
👁️ *Views:* ${videoInfo.views}
📅 *Uploaded:* ${videoInfo.upload}
📦 *Size:* ${sizeMB}
🔗 *Link:* ${videoUrl}

👇 *කරුණාකර පහත නම්බරයෙන් තෝරන්න:*
1️⃣ Video - mp4 📹  
2️⃣ Document - mp4 🗂️  

_Reply with "1" or "2" to continue._
━━━━━━━━━━━━━━
💌 *Made by Mr. Senal*
`;

      await robin.sendMessage(
        from,
        { image: { url: videoInfo.thumbnail }, caption },
        { quoted: mek }
      );

      // 🕒 Wait for user's reply
      const collected = await client.awaitMessage(from, {
        filter: (msg) =>
          msg.key.fromMe === false && ["1", "2"].includes(msg.message?.conversation?.trim()),
        timeout: 15000, // wait max 15s
      });

      const userChoice = collected?.message?.conversation?.trim();

      if (!userChoice) {
        return reply("❌ *සැකසීම අසාර්ථකයි. කරුණාකර නැවත උත්සාහ කරන්න!*");
      }

      // ⏳ Send "uploading" message
      await reply("📤 *Uploading video... Please wait!*");

      if (userChoice === "1") {
        await robin.sendMessage(
          from,
          {
            video: { url: videoInfo.video },
            mimetype: "video/mp4",
            caption: `🎬 *${videoInfo.title}* \n\n📦 Size: ${sizeMB}\n💖 *Uploaded by SENAL MD*`,
          },
          { quoted: mek }
        );
      } else if (userChoice === "2") {
        await robin.sendMessage(
          from,
          {
            document: { url: videoInfo.video },
            mimetype: "video/mp4",
            fileName: `${videoInfo.title}.mp4`,
            caption: `🗂️ *${videoInfo.title}*\n📦 Size: ${sizeMB}\n💖 *Uploaded by SENAL MD*`,
          },
          { quoted: mek }
        );
      } else {
        return reply("❌ *Invalid option. Use 1 or 2 only!*");
      }

      return reply("✅ *Video uploaded successfully!* 🥳");
    } catch (err) {
      console.error(err);
      return reply("❌ *Error occurred:* " + err.message);
    }
  }
);
