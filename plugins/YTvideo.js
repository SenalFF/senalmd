const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const WHATSAPP_MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16 MB
const sessions = {};

async function getFileSize(url) {
  try {
    const head = await axios.head(url);
    const length = head.headers['content-length'];
    return length ? parseInt(length) : null;
  } catch {
    return null;
  }
}

cmd(
  {
    pattern: "playvideo",
    desc: "🎥 YouTube Video Downloader (HD 720p) with send option",
    category: "download",
    react: "🎥",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

      await reply("🔎 Searching for your video... 🎬");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Sorry, no video found. Try another keyword!*");

      await reply("⬇️ Fetching 720p video info... ⏳");

      const quality = "720";
      const result = await ytmp4(video.url, quality);
      if (!result?.download?.url) return reply("⚠️ *Could not fetch the 720p video download link. Try again later.*");

      const videoUrl = result.download.url;
      const fileSize = await getFileSize(videoUrl);
      const fileSizeMB = fileSize ? (fileSize / (1024 * 1024)).toFixed(2) : "Unknown";

      const info = `
🎥 *SENAL MD Video Downloader (HD 720p)*

🎬 *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
📦 *File Size:* ${fileSizeMB} MB
🔗 *URL:* ${video.url}

⚠️ *WhatsApp max normal video size:* 16 MB

📁 *How do you want to receive the video?*
1️⃣ Normal Video File (if size ≤ 16 MB)
2️⃣ Document File (for bigger files or preferred)

✍️ _Please reply with 1 or 2_
`;

      sessions[from] = {
        video,
        videoUrl,
        fileSize,
        step: "choose_send_type",
      };

      await robin.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption: info,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error("PlayVideo Command Error:", e);
      return reply(`❌ *Error:* ${e.message}`);
    }
  }
);

cmd(
  {
    pattern: "^[12]{1}$",
    on: "text",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, text, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_send_type") return;

    const choice = text.trim();

    if (choice === "1") {
      // Normal video
      if (session.fileSize && session.fileSize > WHATSAPP_MAX_VIDEO_SIZE) {
        await reply("⚠️ *File too big for normal video sending! Sending as document instead.*");
      } else {
        await reply("⏳ Uploading video as normal video...");
        try {
          await robin.sendMessage(
            from,
            {
              video: { url: session.videoUrl },
              mimetype: "video/mp4",
              fileName: `${session.video.title.slice(0, 30)}.mp4`,
              caption: "✅ *Video sent by SENAL MD* ❤️",
            },
            { quoted: mek }
          );
          await reply("✅ *Video sent successfully!* 🎥");
          delete sessions[from];
          return;
        } catch (e) {
          console.error("Video send error:", e);
          await reply("❌ *Failed to send video. Sending as document instead...*");
        }
      }
    }

    // For choice "2" or fallback for big files or failed normal send
    await reply("⏳ Uploading video as document...");
    try {
      await robin.sendMessage(
        from,
        {
          document: { url: session.videoUrl },
          mimetype: "video/mp4",
          fileName: `${session.video.title.slice(0, 30)}.mp4`,
          caption: "✅ *Document sent by SENAL MD* ❤️",
        },
        { quoted: mek }
      );
      await reply("✅ *Document sent successfully!* 📄");
    } catch (e) {
      console.error("Document send error:", e);
      await reply("❌ *Failed to send document. Please try again later.*");
    }

    delete sessions[from];
  }
);
