const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

cmd({
  pattern: "play",
  desc: "🎧 Download YouTube Audio via Senal YT DL",
  category: "download",
  react: "🎵",
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗Please provide a YouTube link or song name.");

    const search = await yts(q);
    const data = search.videos[0];
    if (!data?.videoId) return reply("❌ No results found.");

    // Get from Senal YT DL API
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

    // 🎵 Buttons
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

    // 🎶 Button responses
    conn.ev.on("messages.upsert", async (msg) => {
      const btn = msg.messages[0]?.message?.buttonsResponseMessage?.selectedButtonId;
      if (!btn) return;

      if (btn.startsWith("playnow_")) {
        await conn.sendMessage(from, { audio: { url: res.downloadUrl }, mimetype: "audio/mpeg" }, { quoted: mek });
      }

      if (btn.startsWith("down_")) {
        await conn.sendMessage(from, {
          document: { url: res.downloadUrl },
          mimetype: "audio/mpeg",
          fileName: `${res.title}.mp3`,
          caption: "✅ MP3 downloaded from *Senal YT DL*"
        }, { quoted: mek });
      }

      if (btn === "api_info") {
        await reply(`
🧠 *Senal YT DL API Info*
👨‍💻 Developer: Mr Senal
📦 Project: Senal YT DL v2.0
🔗 Endpoint: ${api}
🎵 Powered by https://senalytdl.vercel.app/
        `.trim());
      }
    });

  } catch (err) {
    console.error(err);
    reply("❌ An error occurred while downloading the song.");
  }
});
