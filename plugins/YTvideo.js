const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("ruhend-scraper");

// Dynamic import for fetch (ESM)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// ✅ Normalize YouTube URL
function normalizeYouTubeUrl(input) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
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
  async (robin, mek, m, { from, q, reply, isCreator }) => {
    try {
      if (!q) return reply("🔍 *කරුණාකර නමක් හෝ YouTube ලින්ක් එකක් දෙන්න!*");

      // Normalize or search
      let videoUrl = "";
      let videoInfo = {};
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
        videoInfo = await ytmp4(videoUrl);
      } else {
        const search = await yts(q);
        const result = search.videos[0];
        if (!result) return reply("❌ *වීඩියෝවක් හමු නොවීය. වෙනත් නමක් උත්සාහ කරන්න!*");

        videoUrl = result.url;
        videoInfo = await ytmp4(videoUrl);
      }

      // 📏 Get file size
      const res = await fetch(videoInfo.video, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
        },
      });

      const sizeMB = res.headers.get("content-length")
        ? `${(parseInt(res.headers.get("content-length")) / 1048576).toFixed(2)} MB`
        : "Unknown";

      const caption = `
🎬 *Video Downloader by SENAL MD* 🎬

📌 *Title*     : ${videoInfo.title}
⏱️ *Duration*  : ${videoInfo.duration}
👁️ *Views*     : ${videoInfo.views}
📤 *Uploaded*  : ${videoInfo.upload}
💾 *File Size* : ${sizeMB}
🔗 *Link*      : ${videoUrl}

ℹ️ *ඔබට අවශ්‍ය විදිහට වීඩියෝව එවන්න*:

*1*. 📹 *Video (MP4)*
*2*. 📄 *Document (MP4)*

_ඔබේ උත්තරය 1 හෝ 2 ලෙස යවන්න_
`;

      // Send thumbnail and ask for format
      await robin.sendMessage(
        from,
        { image: { url: videoInfo.thumbnail }, caption },
        { quoted: mek }
      );

      // 👂 Listen for reply
      const filter = (msg) =>
        msg.key.fromMe ||
        (msg.key.remoteJid === from &&
          msg.message?.conversation?.trim().match(/^(1|2)$/));
      const collected = await robin
        .waitForMessage(from, filter, { quoted: mek, timeout: 60_000 })
        .catch(() => null);

      if (!collected) return reply("⏰ *වීඩියෝව යැවීම අවලංගු විය!*");

      const choice = collected.message.conversation.trim();
      reply("📥 *වීඩියෝව අප්ලෝඩ් වෙමින් පවතී...*");

      if (choice === "1") {
        await robin.sendMessage(
          from,
          {
            video: { url: videoInfo.video },
            mimetype: "video/mp4",
            caption: `🎬 *${videoInfo.title}*`,
          },
          { quoted: mek }
        );
      } else {
        await robin.sendMessage(
          from,
          {
            document: { url: videoInfo.video },
            mimetype: "video/mp4",
            fileName: `${videoInfo.title}.mp4`,
            caption: "📄 *Video sent as document by SENAL MD*",
          },
          { quoted: mek }
        );
      }

      return reply("✅ *අවසන්යි! වීඩියෝව යවා අවසන්.* 🎉");
    } catch (e) {
      console.error(e);
      return reply(`❌ *Error*: ${e.message}`);
    }
  }
);
