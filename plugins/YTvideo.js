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

    // 🔍 Search YouTube
    const search = await yts(q);
    const video = search.videos[0];
    if (!video) return reply("❌ No video found for that search.");

    const videoId = video.videoId;

    // 🎚️ Quality selection buttons (added 144p + 240p)
    const buttons = [
      { buttonId: `yt_${videoId}_144`, buttonText: { displayText: "📱 144p" }, type: 1 },
      { buttonId: `yt_${videoId}_240`, buttonText: { displayText: "📲 240p" }, type: 1 },
      { buttonId: `yt_${videoId}_360`, buttonText: { displayText: "📺 360p" }, type: 1 },
      { buttonId: `yt_${videoId}_720`, buttonText: { displayText: "🎬 720p" }, type: 1 },
      { buttonId: `yt_${videoId}_1080`, buttonText: { displayText: "🎞️ 1080p" }, type: 1 },
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

// 🎯 Handle button response (download selected quality)
cmd({
  pattern: "yt_",
  fromMe: false
}, async (conn, mek, m, { from, body, reply }) => {
  try {
    const parts = body.split("_");
    if (parts.length < 3) return;

    const videoId = parts[1];
    const quality = parts[2];

    reply(`⏳ *Downloading ${quality} video... Please wait sir!*`);

    const apiUrl = `https://senalytdl.vercel.app/download?id=${videoId}&format=${quality}`;
    const { data } = await axios.get(apiUrl);

    if (!data || !data.downloadUrl) return reply("❌ Failed to get download link.");

    const caption = `🎥 *Senal YouTube Downloader*\n\n` +
                    `📦 *Quality:* ${quality}\n` +
                    `✅ Sent by *Mr Senal*`;

    await conn.sendMessage(from, {
      video: { url: data.downloadUrl },
      mimetype: "video/mp4",
      caption
    }, { quoted: mek });

  } catch (err) {
    console.error("Error in quality button:", err);
    reply("❌ Error downloading video.");
  }
});
