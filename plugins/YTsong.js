const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

// === PLAY COMMAND ===
cmd({
  pattern: "play",
  desc: "🎧 Download YouTube Audio via Senal YT DL",
  category: "download",
  react: "🎵",
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗Please provide a YouTube link or song name.");

    // Search YouTube
    const search = await yts(q);
    const data = search.videos[0];
    if (!data?.videoId) return reply("❌ No results found.");

    // Get API info from Senal YT DL
    const api = `https://senalytdl.vercel.app/mp3?id=${data.videoId}`;
    const { data: res } = await axios.get(api);

    if (!res.downloadUrl) return reply("❌ Failed to fetch download link from Senal YT DL.");

    const caption = `
🎧 *${res.title}*
👤 *Developer:* Mr Senal
💾 *Format:* MP3 (${res.quality} kbps)
⏱ *Duration:* ${Math.floor(res.duration / 60)}:${(res.duration % 60).toString().padStart(2, "0")}
🔗 *Source:* YouTube
    `.trim();

    // Buttons
    const buttons = [
      { buttonId: `playnow_${data.videoId}`, buttonText: { displayText: "▶️ Play Audio" }, type: 1 },
      { buttonId: `down_${data.videoId}`, buttonText: { displayText: "⬇️ Download Audio" }, type: 1 },
      { buttonId: "api_info", buttonText: { displayText: "ℹ️ API Info" }, type: 1 }
    ];

    // Send thumbnail + caption + buttons
    await conn.sendMessage(from, {
      image: { url: res.thumbnail },
      caption,
      footer: "🚀 Powered by Senal YT DL",
      buttons,
      headerType: 4
    }, { quoted: mek });

  } catch (err) {
    console.error(err);
    reply("❌ An error occurred while processing the song.");
  }
});


// === GLOBAL BUTTON LISTENER ===
conn.ev.on("messages.upsert", async (msg) => {
  try {
    const m = msg.messages[0];
    if (!m) return;

    const btn = m.message?.buttonsResponseMessage?.selectedButtonId;
    if (!btn) return;

    // 🎵 Play Audio button
    if (btn.startsWith("playnow_")) {
      const videoId = btn.split("_")[1];
      const api = `https://senalytdl.vercel.app/mp3?id=${videoId}`;
      const { data: res } = await axios.get(api);
      if (!res.downloadUrl) return;

      await conn.sendMessage(m.key.remoteJid, { audio: { url: res.downloadUrl }, mimetype: "audio/mpeg" }, { quoted: m });
    }

    // 📄 Download Audio Document button
    if (btn.startsWith("down_")) {
      const videoId = btn.split("_")[1];
      const api = `https://senalytdl.vercel.app/mp3?id=${videoId}`;
      const { data: res } = await axios.get(api);
      if (!res.downloadUrl) return;

      await conn.sendMessage(m.key.remoteJid, {
        document: { url: res.downloadUrl },
        mimetype: "audio/mpeg",
        fileName: `${res.title}.mp3`,
        caption: "✅ MP3 sent by *Mr Senal*"
      }, { quoted: m });
    }

    // ℹ️ API Info button
    if (btn === "api_info") {
      await conn.sendMessage(m.key.remoteJid, {
        text: `
🧠 *Senal YT DL API Info*
👨‍💻 Developer: Mr Senal
📦 Project: Senal YT DL v2.0
🔗 Base URL: https://senalytdl.vercel.app/
🎵 Endpoint: /mp3?id=VIDEO_ID
        `.trim()
      }, { quoted: m });
    }

  } catch (err) {
    console.error("Button listener error:", err);
  }
});
