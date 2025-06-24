const { cmd } = require("../command");
const ytdl = require("ytdl-core");
const yts = require("yt-search");

function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "Unknown";
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
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
      if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් යවන්න!*");

      let videoUrl = "";
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
      } else {
        const search = await yts(q);
        const result = search.videos?.[0];
        if (!result) return reply("❌ *වීඩියෝවක් හමු නොවීය. වෙනත් නමක් උත්සහ කරන්න.*");
        videoUrl = result.url;
      }

      const info = await ytdl.getInfo(videoUrl);
      const format = ytdl.chooseFormat(info.formats, {
        quality: "18",
        filter: (f) => f.container === "mp4" && f.hasVideo && f.hasAudio,
      });

      if (!format || !format.url) return reply("❌ *වීඩියෝ විශේෂාංග ලබා ගැනීමට අසමත් විය.*");

      const fileSize = format.contentLength ? formatBytes(parseInt(format.contentLength)) : "Unknown";

      const caption = `
🎞️ *SENAL MD - Video Downloader*

🎧 *Title:* ${info.videoDetails.title}
⏱️ *Duration:* ${info.videoDetails.lengthSeconds}s
📦 *Size:* ${fileSize}
👀 *Views:* ${info.videoDetails.viewCount}
📅 *Uploaded:* ${info.videoDetails.publishDate}
🔗 *URL:* ${videoUrl}

📩 *Reply with:*  
1️⃣ = Send as *Video*  
2️⃣ = Send as *Document*

╰─ _𝙈𝙧 𝙎𝙚𝙣𝙖𝙡 𝘽𝙤𝙩_ 🎧
`;

      await robin.sendMessage(
        from,
        { image: { url: info.videoDetails.thumbnails.pop()?.url }, caption },
        { quoted: mek }
      );

      // Await user reply
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

      if (!choice) return reply("❌ *Time out! Please reply with 1 or 2 within 30 seconds.*");

      await reply("📤 *Uploading Video... Please wait!*");

      // Download video to buffer
      const buffer = await streamToBuffer(ytdl(videoUrl, { format }));

      if (choice === "1") {
        await robin.sendMessage(from, {
          video: buffer,
          mimetype: "video/mp4",
          caption: `🎬 ${info.videoDetails.title}`,
        }, { quoted: mek });
      } else if (choice === "2") {
        await robin.sendMessage(from, {
          document: buffer,
          mimetype: "video/mp4",
          fileName: `${info.videoDetails.title}.mp4`,
          caption: "📂 *Here is your video as a document!*",
        }, { quoted: mek });
      }

      return reply("✅ *Successfully Sent!* 🎉");

    } catch (e) {
      console.error("YT VIDEO ERROR:", e);
      return reply(`❌ *Error:* ${e.message}`);
    }
  }
);
