require("dotenv").config();

const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

// ================== ENV ==================
const API_KEY = process.env.SENAL_YT_API_KEY;
const BASE_URL = process.env.SENAL_YT_BASE;

if (!API_KEY || !BASE_URL) {
  throw new Error("❌ Missing SENAL_YT_API_KEY or SENAL_YT_BASE in .env");
}

// ================== MAIN COMMAND ==================
cmd({
  pattern: "ytv",
  alias: ["yt", "ytvideo", "video"],
  desc: "Senal YT v4.5 Downloader",
  category: "downloader",
  react: "🎥",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗Please provide a YouTube video name or link.");

    await reply("⏳ *Searching YouTube... Please wait Sir!*");

    const search = await yts(q);
    const video = search.videos[0];
    if (!video) return reply("❌ No video found.");

    const videoId = video.videoId;

    const caption = `
🎬 *Senal YT Downloader v4.5*

🎥 *Title:* ${video.title}
📺 *Channel:* ${video.author.name}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
🔗 https://youtu.be/${videoId}

Select your format below 👇
    `.trim();

    const buttons = [
      { buttonId: `video_${videoId}`, buttonText: { displayText: "🎞 Video Formats" }, type: 1 },
      { buttonId: `audio_${videoId}`, buttonText: { displayText: "🎵 Audio Formats" }, type: 1 },
      { buttonId: `api_info`, buttonText: { displayText: "ℹ️ API Info" }, type: 1 }
    ];

    await conn.sendMessage(from, {
      image: { url: video.thumbnail },
      caption,
      footer: "🚀 Powered by Senal YT API v4.5",
      buttons,
      headerType: 4
    }, { quoted: mek });

  } catch (e) {
    console.error("YT Command Error:", e);
    reply("❌ Error while searching video.");
  }
});


// ================== BUTTON HANDLER ==================
cmd({
  buttonHandler: async (conn, mek, btnId) => {
    const remoteJid = mek.key.remoteJid;

    try {

      // ========= API INFO =========
      if (btnId === "api_info") {
        return await conn.sendMessage(remoteJid, {
          text: `
🧠 *Senal YT DL API v4.5*
👨‍💻 Developer: Mr Senal

🔗 Base URL:
${BASE_URL}

🎥 Video:
GET /download?id=VIDEO_ID&format=720&key=YOUR_KEY

🎵 Audio:
GET /download?id=VIDEO_ID&format=mp3&key=YOUR_KEY

Supported Video: 144 → 4320 (8K)
Supported Audio: mp3, ogg, webm, aac, m4a, wav
          `.trim()
        }, { quoted: mek });
      }

      // ========= VIDEO FORMAT MENU =========
      if (btnId.startsWith("video_")) {
        const videoId = btnId.split("_")[1];

        const qualities = ["144","240","360","480","720","1080","1440","2160","4320"];

        const buttons = qualities.map(q => ({
          buttonId: `dl_${videoId}_${q}`,
          buttonText: { displayText: `📺 ${q}p` },
          type: 1
        }));

        return await conn.sendMessage(remoteJid, {
          text: "🎞 Select Video Quality 👇",
          buttons
        }, { quoted: mek });
      }

      // ========= AUDIO FORMAT MENU =========
      if (btnId.startsWith("audio_")) {
        const videoId = btnId.split("_")[1];

        const formats = ["mp3","ogg","webm","aac","m4a","wav"];

        const buttons = formats.map(f => ({
          buttonId: `dl_${videoId}_${f}`,
          buttonText: { displayText: `🎵 ${f.toUpperCase()}` },
          type: 1
        }));

        return await conn.sendMessage(remoteJid, {
          text: "🎵 Select Audio Format 👇",
          buttons
        }, { quoted: mek });
      }

      // ========= DOWNLOAD HANDLER =========
      if (!btnId.startsWith("dl_")) return;

      const [, videoId, format] = btnId.split("_");

      await conn.sendMessage(remoteJid, {
        text: `⏳ *Preparing ${format}... Please wait Sir!*`
      }, { quoted: mek });

      const apiUrl = `${BASE_URL}/download?id=${videoId}&format=${format}&key=${API_KEY}`;

      const { data } = await axios.get(apiUrl, { timeout: 30000 });

      if (!data?.url) {
        return await conn.sendMessage(remoteJid, {
          text: "❌ Failed to fetch download URL."
        }, { quoted: mek });
      }

      // If audio
      if (["mp3","ogg","webm","aac","m4a","wav"].includes(format)) {
        return await conn.sendMessage(remoteJid, {
          audio: { url: data.url },
          mimetype: "audio/mpeg",
          fileName: `${videoId}.${format}`,
          caption: `✅ Audio Downloaded (${format})\n👤 Mr Senal`
        }, { quoted: mek });
      }

      // If video
      await conn.sendMessage(remoteJid, {
        document: { url: data.url },
        mimetype: "video/mp4",
        fileName: `${videoId}_${format}p.mp4`,
        caption: `✅ Video Downloaded (${format}p)\n👤 Mr Senal`
      }, { quoted: mek });

    } catch (err) {
      console.error("Button Error:", err);
      await conn.sendMessage(remoteJid, {
        text: "❌ Something went wrong while processing download."
      }, { quoted: mek });
    }
  }
});
