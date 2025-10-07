const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

cmd({
  pattern: "play",
  desc: "🎧 Download YouTube Audio via Senal YT DL",
  category: "download",
  react: "🎵",
  filename: __filename
}, 
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗Please provide a YouTube link or song name.");

    reply("⏳ *Searching YouTube... Please wait sir!*");

    const search = await yts(q);
    const data = search.videos[0];
    if (!data?.videoId) return reply("❌ No results found.");

    // 🔗 Fetch MP3 info from your API
    const apiUrl = `https://senalytdl.vercel.app/mp3?id=${data.videoId}`;
    const { data: res } = await axios.get(apiUrl);
    if (!res.downloadUrl) return reply("❌ Failed to fetch audio.");

    const caption = `
🎧 *${res.title}*
👤 *Developer:* Mr Senal
💾 *Format:* MP3 (${res.quality} kbps)
⏱ *Duration:* ${Math.floor(res.duration / 60)}:${(res.duration % 60).toString().padStart(2,"0")}
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

  } catch (err) {
    console.error("Error in .play command:", err);
    reply("❌ An error occurred while processing the song.");
  }
});

// ✅ Global button handler (integrated with your main system)
cmd({
  buttonHandler: async (conn, mek, btnId) => {
    const remoteJid = mek.key.remoteJid;

    try {
      // ▶️ Play Audio
      if (btnId.startsWith("playnow_")) {
        const videoId = btnId.split("_")[1];
        await conn.sendMessage(remoteJid, { text: "⏳ *Fetching and sending audio...*" }, { quoted: mek });

        const { data: res } = await axios.get(`https://senalytdl.vercel.app/mp3?id=${videoId}`);
        if (!res.downloadUrl) return conn.sendMessage(remoteJid, { text: "❌ Failed to fetch audio." }, { quoted: mek });

        await conn.sendMessage(remoteJid, {
          audio: { url: res.downloadUrl },
          mimetype: "audio/mpeg",
          ptt: false,
          caption: `🎵 *${res.title}*\n✅ Sent by *Mr Senal*`
        }, { quoted: mek });
      }

      // ⬇️ Download Audio as document
      else if (btnId.startsWith("down_")) {
        const videoId = btnId.split("_")[1];
        await conn.sendMessage(remoteJid, { text: "⏳ *Downloading audio...*" }, { quoted: mek });

        const { data: res } = await axios.get(`https://senalytdl.vercel.app/mp3?id=${videoId}`);
        if (!res.downloadUrl) return conn.sendMessage(remoteJid, { text: "❌ Failed to fetch audio." }, { quoted: mek });

        await conn.sendMessage(remoteJid, {
          document: { url: res.downloadUrl },
          mimetype: "audio/mpeg",
          fileName: `${res.title}.mp3`,
          caption: "✅ MP3 file sent by *Mr Senal*"
        }, { quoted: mek });
      }

      // ℹ️ API Info
      else if (btnId === "api_info") {
        await conn.sendMessage(remoteJid, {
          text: `
🧠 *Senal YT DL API Info*
👨‍💻 Developer: Mr Senal
📦 Project: Senal YT DL v2.0
🔗 Base URL: https://senalytdl.vercel.app/
🎵 Endpoint: /mp3?id=VIDEO_ID
          `.trim()
        }, { quoted: mek });
      }

    } catch (err) {
      console.error("Button handler error:", err);
      await conn.sendMessage(remoteJid, { text: "❌ Something went wrong while handling the button." }, { quoted: mek });
    }
  }
});
