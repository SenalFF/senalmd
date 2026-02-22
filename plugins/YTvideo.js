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
      { buttonId: `video__${videoId}`, buttonText: { displayText: "🎞 Video Formats" }, type: 1 },
      { buttonId: `audio__${videoId}`, buttonText: { displayText: "🎵 Audio Formats" }, type: 1 },
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
      // btnId format: "video__VIDEOID"
      if (btnId.startsWith("video__")) {
        const videoId = btnId.slice("video__".length);

        const qualities = ["144","240","360","480","720","1080","1440","2160","4320"];

        const buttons = qualities.map(q => ({
          buttonId: `dl__${videoId}__${q}`,
          buttonText: { displayText: `📺 ${q}p` },
          type: 1
        }));

        return await conn.sendMessage(remoteJid, {
          text: "🎞 Select Video Quality 👇",
          buttons
        }, { quoted: mek });
      }

      // ========= AUDIO FORMAT MENU =========
      // btnId format: "audio__VIDEOID"
      if (btnId.startsWith("audio__")) {
        const videoId = btnId.slice("audio__".length);

        const formats = ["mp3","ogg","webm","aac","m4a","wav"];

        const buttons = formats.map(f => ({
          buttonId: `dl__${videoId}__${f}`,
          buttonText: { displayText: `🎵 ${f.toUpperCase()}` },
          type: 1
        }));

        return await conn.sendMessage(remoteJid, {
          text: "🎵 Select Audio Format 👇",
          buttons
        }, { quoted: mek });
      }

      // ========= DOWNLOAD HANDLER =========
      // btnId format: "dl__VIDEOID__FORMAT"
      if (!btnId.startsWith("dl__")) return;

      // Safe split using double underscore to avoid breaking on videoId characters
      const withoutPrefix = btnId.slice("dl__".length); // "VIDEOID__FORMAT"
      const lastSep = withoutPrefix.lastIndexOf("__");
      if (lastSep === -1) return;

      const videoId = withoutPrefix.slice(0, lastSep);
      const format = withoutPrefix.slice(lastSep + 2);

      if (!videoId || !format) {
        return await conn.sendMessage(remoteJid, {
          text: "❌ Invalid download request."
        }, { quoted: mek });
      }

      await conn.sendMessage(remoteJid, {
        text: `⏳ *Preparing ${format}... Please wait Sir!*`
      }, { quoted: mek });

      const apiUrl = `${BASE_URL}/download?id=${videoId}&format=${format}&key=${API_KEY}`;

      let data;
      try {
        const response = await axios.get(apiUrl, { timeout: 300000 }); // ✅ 5 min timeout
        data = response.data;
      } catch (axiosErr) {
        const isTimeout = axiosErr.code === "ECONNABORTED";
        return await conn.sendMessage(remoteJid, {
          text: isTimeout
            ? "⏳ *Download timed out. The server is busy. Please try again.*"
            : `❌ API request failed: ${axiosErr.message}`
        }, { quoted: mek });
      }

      // ✅ API returns "download" field, not "url"
      const downloadUrl = data?.download;

      if (!downloadUrl) {
        return await conn.sendMessage(remoteJid, {
          text: `❌ Failed to fetch download URL.\n\n*API Response:* ${JSON.stringify(data)}`
        }, { quoted: mek });
      }

      const audioFormats = ["mp3","ogg","webm","aac","m4a","wav"];

      // ========= SEND AUDIO =========
      if (audioFormats.includes(format)) {
        return await conn.sendMessage(remoteJid, {
          audio: { url: downloadUrl },
          mimetype: "audio/mpeg",
          fileName: `${videoId}.${format}`,
          caption: `✅ *Audio Downloaded (${format.toUpperCase()})*\n👤 Powered by Mr Senal`
        }, { quoted: mek });
      }

      // ========= SEND VIDEO =========
      await conn.sendMessage(remoteJid, {
        document: { url: downloadUrl },
        mimetype: "video/mp4",
        fileName: `${videoId}_${format}p.mp4`,
        caption: `✅ *Video Downloaded (${format}p)*\n👤 Powered by Mr Senal`
      }, { quoted: mek });

    } catch (err) {
      console.error("Button Error:", err);
      await conn.sendMessage(remoteJid, {
        text: "❌ Something went wrong while processing download."
      }, { quoted: mek });
    }
  }
});
