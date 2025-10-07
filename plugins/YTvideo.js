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

// ✅ Global button click handler (only one, avoids duplicates)
cmd({
  pattern: "global_button_handler",
  fromMe: false
}, async (conn) => {
  conn.ev.on("messages.upsert", async (msgUpdate) => {
    const mek = msgUpdate.messages[0];
    if (!mek?.message?.buttonsResponseMessage) return;

    const btnId = mek.message.buttonsResponseMessage.selectedButtonId;
    if (!btnId || !btnId.startsWith("yt_")) return;

    try {
      const remoteJid = mek.key.remoteJid;
      const [, videoId, format] = btnId.split("_");

      await conn.sendMessage(remoteJid, { text: `⏳ *Downloading ${format}p video... Please wait sir!*` }, { quoted: mek });

      const apiUrl = `https://senalytdl.vercel.app/download?id=${videoId}&format=${format}`;
      const { data } = await axios.get(apiUrl);

      if (!data.downloadUrl) return conn.sendMessage(remoteJid, { text: "❌ Failed to get download link." }, { quoted: mek });

      await conn.sendMessage(remoteJid, {
        video: { url: data.downloadUrl },
        mimetype: "video/mp4",
        caption: `✅ *${format}p video sent by Mr Senal*`
      }, { quoted: mek });

    } catch (err) {
      console.error("YT Button Error:", err);
      conn.sendMessage(mek.key.remoteJid, { text: "❌ Error downloading video." }, { quoted: mek });
    }
  });
});
