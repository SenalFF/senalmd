const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const sessions = {};

async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

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

cmd(
  {
    pattern: "video",
    desc: "📽️ YouTube Video Downloader (choose quality)",
    category: "download",
    react: "🎬",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

      await reply("🔎 Searching YouTube...");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *No video found. Try another keyword.*");

      sessions[from] = {
        video,
        step: "choose_quality",
      };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

📺 *Choose your quality:*
🟢 Reply with:
- *sd* = 360p (smaller file)
- *hd* = 720p (higher quality)

⚠️ _Videos larger than 50MB will be sent as document._
`;

      await robin.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption: info,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error("Video Command Error:", e);
      return reply(`❌ *Error:* ${e.message}`);
    }
  }
);

// Handler for 'sd' or 'hd' reply
const handleVideoDownload = (quality) =>
  cmd(
    {
      pattern: quality,
      on: "text",
      dontAddCommandList: true,
    },
    async (robin, mek, m, { from, reply }) => {
      const session = sessions[from];
      if (!session || session.step !== "choose_quality") return;

      const video = session.video;
      session.step = "downloading";

      try {
        await reply(`📥 Downloading video in *${quality.toUpperCase()}*...`);

        const result = await ytmp4(video.url, quality === "hd" ? "720" : "360");
        if (!result?.download?.url) return reply("❌ *Download link not available. Try another video.*");

        const buffer = await downloadFile(result.download.url);
        const filesize = buffer.length;

        if (filesize > MAX_VIDEO_SIZE) {
          await reply(`⚠️ *Video is ${(filesize / (1024 * 1024)).toFixed(2)} MB. Sending as document...*`);
          await sendDocument(robin, from, mek, buffer, video.title);
        } else {
          await reply("⏳ Uploading video...");
          await sendVideo(robin, from, mek, buffer, video.title);
        }

        await reply("✅ *Done!*");
      } catch (e) {
        console.error(`Video (${quality}) error:`, e);
        await reply("❌ *Failed to send video. Try again later.*");
      }

      delete sessions[from];
    }
  );

// Register both sd and hd commands
handleVideoDownload("sd");
handleVideoDownload("hd");
