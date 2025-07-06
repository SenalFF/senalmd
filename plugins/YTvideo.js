const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const sessions = {};

// Download file buffer
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// Send video inline
async function sendVideo(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      video: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "🎬 *Video sent by SENAL MD* 🎥",
    },
    { quoted: mek }
  );
}

// Send as document
async function sendDocument(robin, from, mek, buffer, title) {
  await robin.sendMessage(
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

// Main video command
cmd(
  {
    pattern: "video",
    desc: "🎬 YouTube Video Downloader with HD or SD",
    category: "download",
    react: "🎥",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

      await reply("🔎 Searching YouTube...");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *No video found. Try another keyword.*");

      // Save session
      sessions[from] = {
        video,
        step: "choose_quality",
      };

      // Buttons
      const buttons = [
        { buttonId: "video_sd", buttonText: { displayText: "📥 SD (360p)" }, type: 1 },
        { buttonId: "video_hd", buttonText: { displayText: "📺 HD (720p)" }, type: 1 }
      ];

      const buttonMessage = {
        image: { url: video.thumbnail },
        caption: `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
📺 *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}

📦 *Choose Quality:*
        `,
        footer: "Reply using the buttons below",
        buttons,
        headerType: 4,
        viewOnce: true
      };

      await robin.sendMessage(from, buttonMessage, { quoted: mek });
    } catch (e) {
      console.error("Video command error:", e);
      await reply("❌ *Error occurred. Please try again later.*");
    }
  }
);

// Button handler function
const handleQuality = (quality) =>
  cmd(
    {
      pattern: `video_${quality}`,
    },
    async (robin, mek, m, { from, reply }) => {
      const session = sessions[from];
      if (!session || session.step !== "choose_quality") return;

      const video = session.video;
      session.step = "downloading";

      try {
        await reply(`📥 Downloading *${quality.toUpperCase()}* video...`);

        const result = await ytmp4(video.url, quality === "hd" ? "720" : "360");
        if (!result?.download?.url) return reply("❌ *Download link not available. Try again later.*");

        const buffer = await downloadFile(result.download.url);
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        if (buffer.length > MAX_VIDEO_SIZE) {
          await reply(`⚠️ *Video is ${sizeMB} MB. Sending as document...*`);
          await sendDocument(robin, from, mek, buffer, video.title);
        } else {
          await reply("⏳ Uploading...");
          await sendVideo(robin, from, mek, buffer, video.title);
        }

        await reply("✅ *Done!*");
      } catch (e) {
        console.error("Video send error:", e);
        await reply("❌ *Error while sending video.*");
      }

      delete sessions[from];
    }
  );

// Register button handlers
handleQuality("sd");
handleQuality("hd");
