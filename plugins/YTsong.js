const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");
const { getBuffer } = require("../lib/functions"); // make sure this exists

cmd({
  pattern: "play",
  desc: "🎧 Download YouTube Audio via Senal YT DL",
  category: "download",
  react: "🎵",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  if (!q) return reply("❗Please provide a YouTube link or song name.");

  try {
    // Search YouTube
    const search = await yts(q);
    const data = search.videos[0];
    if (!data?.videoId) return reply("❌ No results found.");

    // Get API info
    const api = `https://senalytdl.vercel.app/mp3?id=${data.videoId}`;
    const { data: res } = await axios.get(api);
    if (!res.downloadUrl) return reply("❌ Failed to fetch audio.");

    const caption = `
🎧 *${res.title}*
👤 *Developer:* Mr Senal
💾 *Format:* MP3 (${res.quality} kbps)
⏱ *Duration:* ${Math.floor(res.duration / 60)}:${(res.duration % 60).toString().padStart(2,"0")}
🔗 *Source:* YouTube
    `.trim();

    // Buttons
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

// ================= Handle Button Clicks =================
conn.ev.on("messages.upsert", async msgUpdate => {
  const m = msgUpdate.messages[0];
  if (!m?.message?.buttonsResponseMessage) return;
  const btn = m.message.buttonsResponseMessage.selectedButtonId;
  if (!btn) return;

  const remoteJid = m.key.remoteJid;

  try {
    // Play audio directly
    if (btn.startsWith("playnow_")) {
      const videoId = btn.split("_")[1];
      const { data: res } = await axios.get(`https://senalytdl.vercel.app/mp3?id=${videoId}`);
      if (!res.downloadUrl) return;

      const buffer = await getBuffer(res.downloadUrl);

      await conn.sendMessage(remoteJid, { audio: buffer, mimetype: "audio/mpeg" }, { quoted: m });
    }

    // Download as document
    if (btn.startsWith("down_")) {
      const videoId = btn.split("_")[1];
      const { data: res } = await axios.get(`https://senalytdl.vercel.app/mp3?id=${videoId}`);
      if (!res.downloadUrl) return;

      const buffer = await getBuffer(res.downloadUrl);

      await conn.sendMessage(remoteJid, {
        document: buffer,
        mimetype: "audio/mpeg",
        fileName: `${res.title}.mp3`,
        caption: "✅ MP3 sent by *Mr Senal*"
      }, { quoted: m });
    }

    // API Info
    if (btn === "api_info") {
      await conn.sendMessage(remoteJid, {
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
    console.error("Button handler error:", err);
  }
});
