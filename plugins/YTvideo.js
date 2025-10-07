const { cmd } = require('../command');
const yts = require('yt-search');
const axios = require('axios');

cmd({
  pattern: "ytv",
  alias: ["yt", "ytvideo", "video", ],
  desc: "Download YouTube videos with multiple quality options",
  category: "downloader",
  react: "🎥",
  filename: __filename
},
async (conn, mek, m, { from, args, q, reply }) => {
  try {
    if (!q) return reply("❗Please provide a YouTube video name or link.");

    reply("⏳ *Searching YouTube... Please wait sir!*");

    const search = await yts(q);
    const video = search.videos[0];
    if (!video) return reply("❌ No video found.");

    const videoId = video.videoId;

    // 🎛 Quality + API Info Buttons
    const buttons = [
      { buttonId: `ytdl_${videoId}_144`, buttonText: { displayText: "📱 144p" }, type: 1 },
      { buttonId: `ytdl_${videoId}_240`, buttonText: { displayText: "📲 240p" }, type: 1 },
      { buttonId: `ytdl_${videoId}_360`, buttonText: { displayText: "📺 360p" }, type: 1 },
      { buttonId: `ytdl_${videoId}_720`, buttonText: { displayText: "🎬 720p" }, type: 1 },
      { buttonId: `ytdl_${videoId}_1080`, buttonText: { displayText: "🎞️ 1080p" }, type: 1 },
      { buttonId: `api_info`, buttonText: { displayText: "ℹ️ API Info" }, type: 1 }
    ];

    const caption = `🎬 *Senal YT Downloader*\n\n` +
      `🎥 *Title:* ${video.title}\n` +
      `📺 *Channel:* ${video.author.name}\n` +
      `⏱️ *Duration:* ${video.timestamp}\n` +
      `👁️ *Views:* ${video.views}\n` +
      `📎 *Link:* https://youtu.be/${videoId}\n\n` +
      `Select your *video quality* below 👇`;

    await conn.sendMessage(from, {
      image: { url: video.thumbnail },
      caption,
      footer: "🔗 Powered by Senal API",
      buttons,
      headerType: 4
    }, { quoted: mek });

  } catch (e) {
    console.error("Error in YouTube Downloader:", e);
    reply(`❌ Error: ${e.message}`);
  }
});


// ✅ BUTTON HANDLER
cmd({
  buttonHandler: async (conn, mek, btnId) => {
    const remoteJid = mek.key.remoteJid;

    try {
      // ℹ️ API Info Button
      if (btnId === "api_info") {
        await conn.sendMessage(remoteJid, {
          text: `
🧠 *Senal YT DL API Info*
👨‍💻 Developer: Mr Senal
📦 Project: Senal YT DL v2.0
🔗 Base URL: https://senalytdl.vercel.app/
🎥 Video Endpoint: /download?id=VIDEO_ID&format=QUALITY
🎵 Audio Endpoint: /mp3?id=VIDEO_ID
💬 Example: https://senalytdl.vercel.app/download?id=dQw4w9WgXcQ&format=720
          `.trim()
        }, { quoted: mek });
        return;
      }

      // 🎞 Handle Video Download Buttons
      if (!btnId.startsWith("ytdl_")) return;
      const [_, videoId, format] = btnId.split("_");

      await conn.sendMessage(remoteJid, {
        text: `⏳ *Downloading ${format}p video... Please wait sir!*`
      }, { quoted: mek });

      const apiUrl = `https://senalytdl.vercel.app/download?id=${videoId}&format=${format}`;
      const { data } = await axios.get(apiUrl);

      if (!data.downloadUrl) {
        return conn.sendMessage(remoteJid, {
          text: "❌ Failed to get download link."
        }, { quoted: mek });
      }

      // 📄 Always send as document
      await conn.sendMessage(remoteJid, {
        document: { url: data.downloadUrl },
        mimetype: "video/mp4",
        fileName: `${format}p_${videoId}.mp4`,
        caption: `✅ *${format}p video downloaded by Mr Senal*\n🎬 From: https://youtu.be/${videoId}`
      }, { quoted: mek });

    } catch (err) {
      console.error("Button handler error:", err);
      await conn.sendMessage(remoteJid, {
        text: "❌ Something went wrong while handling the button."
      }, { quoted: mek });
    }
  }
});
