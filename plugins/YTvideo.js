const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const QUALITY_MAP = {
  1: "144",
  2: "240",
  3: "360",
  4: "480",
  5: "720",
  6: "1080",
};

const sessions = {};

async function getFileSizeMB(url) {
  try {
    const response = await axios.head(url);
    const length = response.headers['content-length'];
    if (!length) return null;
    return (parseInt(length) / (1024 * 1024)).toFixed(2);
  } catch {
    return null;
  }
}

cmd(
  {
    pattern: "playvideo",
    desc: "🎥 YouTube Video Downloader with quality & filesize info",
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

      // Get a sample download URL at default quality (360p) for size check
      const tempQuality = "360";
      const result = await ytmp4(video.url, tempQuality);
      let fileSizeMB = null;
      if (result?.download?.url) {
        fileSizeMB = await getFileSizeMB(result.download.url);
      }

      let sizeText = fileSizeMB ? `${fileSizeMB} MB (approx at 360p)` : "Unknown";

      const info = `
🎥 *SENAL MD Video Downloader*

🎬 *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
📦 *Approx File Size:* ${sizeText}
🔗 *URL:* ${video.url}

📁 *Select the video quality you want (send the number):*

1️⃣ 144p
2️⃣ 240p
3️⃣ 360p
4️⃣ 480p
5️⃣ 720p
6️⃣ 1080p

✍️ _Please reply with 1-6_

⚠️ _The video will always be sent as a document._
`;

      sessions[from] = {
        video,
        step: "choose_quality",
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
    pattern: "^[1-6]{1}$",
    on: "text",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, text, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_quality") return;

    const choice = text.trim();
    const quality = QUALITY_MAP[choice];
    if (!quality) return reply("❌ *Invalid choice. Please reply with a number 1 to 6.*");

    await reply(`⬇️ Fetching video at *${quality}p* quality... ⏳`);

    try {
      const result = await ytmp4(session.video.url, quality);
      if (!result?.download?.url) return reply("⚠️ *Could not fetch the download link. Try again later.*");

      const videoUrl = result.download.url;

      await reply("⏳ Uploading video as document...");

      await robin.sendMessage(
        from,
        {
          document: { url: videoUrl },
          mimetype: "video/mp4",
          fileName: `${session.video.title.slice(0, 30)}.mp4`,
          caption: "✅ *Document sent by SENAL MD* ❤️",
        },
        { quoted: mek }
      );

      await reply("✅ *Document sent successfully!* 📄");
    } catch (e) {
      console.error("Video send error:", e);
      await reply("❌ *Failed to send video/document. Please try again later.*");
    }

    delete sessions[from];
  }
);
