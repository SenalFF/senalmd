const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
const sessions = {};

// Download buffer from URL
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// Send as inline video
async function sendVideo(sock, from, mek, buffer, title) {
  await sock.sendMessage(
    from,
    {
      video: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: `🎬 *${title}*`,
    },
    { quoted: mek }
  );
}

// Send as document
async function sendDocument(sock, from, mek, buffer, title) {
  await sock.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "✅ *Document sent by SENAL MD* ❤️",
    },
    { quoted: mek }
  );
}

// .video command
cmd(
  {
    pattern: "video",
    desc: "🎬 Download YouTube video (reply 1 or 2)",
    category: "download",
    react: "🎥",
  },
  async (sock, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 කරුණාකර YouTube වීඩියෝ නමක් හෝ ලින්ක් එකක් ලබාදෙන්න.");

      await reply("🔎 Searching YouTube...");

      const result = await yts(q);
      const video = result.videos[0];
      if (!video) return reply("❌ Video not found.");

      const thumb = await axios.get(video.thumbnail, { responseType: "arraybuffer" });
      const imageBuffer = Buffer.from(thumb.data);

      const sizeText = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ Duration: ${video.timestamp}
👁️ Views: ${video.views.toLocaleString()}
📤 Uploaded: ${video.ago}
🔗 URL: ${video.url}

🎥 *Select Quality:*
1️⃣ SD (360p)
2️⃣ HD (720p)

✍️ _Please reply with 1 or 2_
      `.trim();

      // Save session
      sessions[from] = {
        video,
        step: "choose_quality",
      };

      await sock.sendMessage(
        from,
        {
          image: imageBuffer,
          caption: sizeText,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("YT Video Search Error:", err);
      await reply("❌ Error occurred while processing the video.");
    }
  }
);

// Handle reply 1 (SD 360p)
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (sock, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_quality") return;

    const video = session.video;

    try {
      await reply("📥 Downloading SD 360p video...");

      const res = await ytmp4(video.url, "360");
      if (!res?.download?.url) return reply("❌ Failed to fetch download link.");

      const buffer = await downloadFile(res.download.url);
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

      if (buffer.length > MAX_VIDEO_SIZE) {
        await reply(`⚠️ Video is ${sizeMB} MB. Sending as document...`);
        await sendDocument(sock, from, mek, buffer, video.title);
      } else {
        await sendVideo(sock, from, mek, buffer, video.title);
      }

      await reply("✅ *Video sent successfully!* 🎉");
    } catch (err) {
      console.error("Download error (360p):", err);
      await reply("❌ Error sending SD video.");
    }

    delete sessions[from];
  }
);

// Handle reply 2 (HD 720p)
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (sock, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_quality") return;

    const video = session.video;

    try {
      await reply("📥 Downloading HD 720p video...");

      const res = await ytmp4(video.url, "720");
      if (!res?.download?.url) return reply("❌ Failed to fetch download link.");

      const buffer = await downloadFile(res.download.url);
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

      if (buffer.length > MAX_VIDEO_SIZE) {
        await reply(`⚠️ Video is ${sizeMB} MB. Sending as document...`);
        await sendDocument(sock, from, mek, buffer, video.title);
      } else {
        await sendVideo(sock, from, mek, buffer, video.title);
      }

      await reply("✅ *Video sent successfully!* 🎉");
    } catch (err) {
      console.error("Download error (720p):", err);
      await reply("❌ Error sending HD video.");
    }

    delete sessions[from];
  }
);
