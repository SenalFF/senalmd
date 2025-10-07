const { cmd } = require('../command');
const yts = require('yt-search');
const axios = require('axios');

cmd({
  pattern: "ytdl",
  alias: ["yt", "ytvideo", "video", "play"],
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

    // 🎛 Quality Buttons
    const buttons = [
      { buttonId: `ytdl_${videoId}_144`, buttonText: { displayText: "📱 144p" }, type: 1 },
      { buttonId: `ytdl_${videoId}_240`, buttonText: { displayText: "📲 240p" }, type: 1 },
      { buttonId: `ytdl_${videoId}_360`, buttonText: { displayText: "📺 360p" }, type: 1 },
      { buttonId: `ytdl_${videoId}_720`, buttonText: { displayText: "🎬 720p" }, type: 1 },
      { buttonId: `ytdl_${videoId}_1080`, buttonText: { displayText: "🎞️ 1080p" }, type: 1 },
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
      buttons,
      headerType: 4
    }, { quoted: mek });

  } catch (e) {
    console.error("Error in YouTube Downloader:", e);
    reply(`❌ Error: ${e.message}`);
  }
});


// ✅ BUTTON HANDLER (works with global button system)
cmd({
  buttonHandler: async (conn, mek, btnId) => {
    if (!btnId.startsWith("ytdl_")) return;

    try {
      const [_, videoId, format] = btnId.split("_");
      const remoteJid = mek.key.remoteJid;

      await conn.sendMessage(remoteJid, {
        text: `⏳ *Downloading ${format}p video... Please wait sir!*`
      }, { quoted: mek });

      // 🔗 Your API Endpoint
      const apiUrl = `https://senalytdl.vercel.app/download?id=${videoId}&format=${format}`;
      const { data } = await axios.get(apiUrl);

      if (!data.downloadUrl) {
        return conn.sendMessage(remoteJid, {
          text: "❌ Failed to get download link."
        }, { quoted: mek });
      }

      await conn.sendMessage(remoteJid, {
        video: { url: data.downloadUrl },
        mimetype: "video/mp4",
        caption: `✅ *${format}p video downloaded by Mr Senal*`
      }, { quoted: mek });

    } catch (err) {
      console.error("YT Button Error:", err);
      conn.sendMessage(mek.key.remoteJid, {
        text: "❌ Error downloading video."
      }, { quoted: mek });
    }
  }
});
