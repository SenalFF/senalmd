const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

cmd({
  pattern: "play",
  desc: "🎧 Download YouTube Audio via Senal YT DL",
  category: "download",
  react: "🎵",
  async function(conn, mek, m, { from, q, reply }) {
    if (!q) return reply("❗Please provide a YouTube link or song name.");

    // Search YouTube
    const search = await yts(q);
    const data = search.videos[0];
    if (!data?.videoId) return reply("❌ No results found.");

    const api = `https://senalytdl.vercel.app/mp3?id=${data.videoId}`;
    const { data: res } = await axios.get(api);
    if (!res.downloadUrl) return reply("❌ Failed to fetch download link.");

    const caption = `
🎧 *${res.title}*
👤 *Developer:* Mr Senal
💾 *Format:* MP3 (${res.quality} kbps)
⏱ *Duration:* ${Math.floor(res.duration / 60)}:${(res.duration % 60).toString().padStart(2, "0")}
🔗 *Source:* YouTube
    `.trim();

    const buttons = [
      { buttonId: `playnow_${data.videoId}`, buttonText: { displayText: "▶️ Play Audio" }, type: 1 },
      { buttonId: `down_${data.videoId}`, buttonText: { displayText: "⬇️ Download Audio" }, type: 1 },
      { buttonId: "api_info", buttonText: { displayText: "ℹ️ API Info" }, type: 1 }
    ];

    await conn.sendMessage(from, {
      image: { url: res.thumbnail },
      caption,
      footer: "🚀 Powered by Senal YT DL",
      buttons,
      headerType: 4
    }, { quoted: mek });

    // Save data for button handler
    this.lastVideo = { videoId: data.videoId, downloadUrl: res.downloadUrl, title: res.title };
  }
});

// ===== Button Handler =====
cmd({
  pattern: null, // no command trigger
  buttonHandler: async (conn, mek, btnId) => {
    const plugin = require("./ytsong"); // plugin itself
    const data = plugin.lastVideo;
    if (!data) return;

    if (btnId === `playnow_${data.videoId}`) {
      await conn.sendMessage(mek.key.remoteJid, { audio: { url: data.downloadUrl }, mimetype: "audio/mpeg" }, { quoted: mek });
    }

    if (btnId === `down_${data.videoId}`) {
      await conn.sendMessage(mek.key.remoteJid, {
        document: { url: data.downloadUrl },
        mimetype: "audio/mpeg",
        fileName: `${data.title}.mp3`,
        caption: "✅ MP3 sent by *Mr Senal*"
      }, { quoted: mek });
    }

    if (btnId === "api_info") {
      await conn.sendMessage(mek.key.remoteJid, {
        text: `
🧠 *Senal YT DL API Info*
👨‍💻 Developer: Mr Senal
📦 Project: Senal YT DL v2.0
🔗 Base URL: https://senalytdl.vercel.app/
🎵 Endpoint: /mp3?id=VIDEO_ID
      `.trim()
      }, { quoted: mek });
    }
  }
});
