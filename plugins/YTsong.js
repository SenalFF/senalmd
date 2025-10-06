const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

cmd({
  pattern: "play",
  desc: "🎧 Download YouTube Audio via Senal YT DL",
  category: "download",
  react: "🎵",
  filename: __filename
}, async (conn, m, store, { from, args, q, reply }) => {
  if (!q) return reply("❗Please provide a YouTube link or song name.");

  try {
    // Search YouTube
    const search = await yts(q);
    const data = search.videos[0];
    if (!data?.videoId) return reply("❌ No results found.");

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
    }, { quoted: m });

    // ===== Handle Buttons =====
    conn.ev.on("messages.upsert", async (messageUpdate) => {
      const mek = messageUpdate.messages[0];
      if (!mek?.message?.buttonsResponseMessage) return;

      const btnId = mek.message.buttonsResponseMessage.selectedButtonId;
      if (!btnId) return;

      const remoteJid = mek.key.remoteJid;

      try {
        if (btnId.startsWith("playnow_")) {
          const videoId = btnId.split("_")[1];
          const { data: res } = await axios.get(`https://senalytdl.vercel.app/mp3?id=${videoId}`);
          if (!res.downloadUrl) return;
          await conn.sendMessage(remoteJid, { audio: { url: res.downloadUrl }, mimetype: "audio/mpeg" }, { quoted: mek });
        }

        if (btnId.startsWith("down_")) {
          const videoId = btnId.split("_")[1];
          const { data: res } = await axios.get(`https://senalytdl.vercel.app/mp3?id=${videoId}`);
          if (!res.downloadUrl) return;
          await conn.sendMessage(remoteJid, { document: { url: res.downloadUrl }, mimetype: "audio/mpeg", fileName: `${res.title}.mp3`, caption: "✅ MP3 sent by *Mr Senal*" }, { quoted: mek });
        }

        if (btnId === "api_info") {
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
        console.error("YT Song button error:", err);
      }
    });

  } catch (err) {
    console.error("YT Song command error:", err);
    reply("❌ An error occurred while processing the song.");
  }
});
