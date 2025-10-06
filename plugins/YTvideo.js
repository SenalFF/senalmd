const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

const formats = ["144", "240", "360", "480", "720", "1080", "mp3"];

cmd({
  pattern: "video",
  desc: "📹 Download YouTube Video or Audio via Senal YT DL",
  category: "download",
  react: "📹",
  filename: __filename
}, async (conn, m, store, { from, args, q, reply }) => {
  if (!q) return reply("❗Please provide a YouTube link or video name.");

  try {
    // Search YouTube
    const search = await yts(q);
    const data = search.videos[0];
    if (!data?.videoId) return reply("❌ No results found.");

    const caption = `
📹 *${data.title}*
👤 *Developer:* Mr Senal
🔗 *Source:* YouTube
⏱ *Duration:* ${data.timestamp}
    `.trim();

    // Buttons for available formats
    const buttons = formats.map(f => ({
      buttonId: `dl_${data.videoId}_${f}`,
      buttonText: { displayText: f === "mp3" ? "🎵 MP3" : `${f}p` },
      type: 1
    }));

    buttons.push({ buttonId: "api_info_vid", buttonText: { displayText: "ℹ️ API Info" }, type: 1 });

    await conn.sendMessage(from, {
      image: { url: data.thumbnail },
      caption,
      footer: "🚀 Powered by Senal YT DL",
      buttons,
      headerType: 4
    }, { quoted: m });

  } catch (err) {
    console.error("Error in YT Video command:", err);
    reply("❌ An error occurred while processing your video.");
  }

  // ===== Handle Button Clicks =====
  conn.ev.on("messages.upsert", async (messageUpdate) => {
    const mek = messageUpdate.messages[0];
    if (!mek?.message?.buttonsResponseMessage) return;

    const btnId = mek.message.buttonsResponseMessage.selectedButtonId;
    if (!btnId) return;

    try {
      if (btnId.startsWith("dl_")) {
        const [, videoId, format] = btnId.split("_");
        const apiUrl = format === "mp3"
          ? `https://senalytdl.vercel.app/mp3?id=${videoId}`
          : `https://senalytdl.vercel.app/download?id=${videoId}&format=${format}`;

        const { data: res } = await axios.get(apiUrl);
        if (!res.downloadUrl) return;

        const remoteJid = mek.key.remoteJid;

        if (format === "mp3") {
          await conn.sendMessage(remoteJid, { audio: { url: res.downloadUrl }, mimetype: "audio/mpeg" }, { quoted: mek });
          await conn.sendMessage(remoteJid, { document: { url: res.downloadUrl }, mimetype: "audio/mpeg", fileName: `${res.title}.mp3`, caption: "✅ MP3 sent by *Mr Senal*" }, { quoted: mek });
        } else {
          await conn.sendMessage(remoteJid, { video: { url: res.downloadUrl }, mimetype: "video/mp4" }, { quoted: mek });
          await conn.sendMessage(remoteJid, { document: { url: res.downloadUrl }, mimetype: "video/mp4", fileName: `${res.title}_${format}.mp4`, caption: `✅ Video ${format}p sent by *Mr Senal*` }, { quoted: mek });
        }
      }

      if (btnId === "api_info_vid") {
        await conn.sendMessage(mek.key.remoteJid, {
          text: `
🧠 *Senal YT DL API Info*
👨‍💻 Developer: Mr Senal
📦 Project: Senal YT DL v2.0
🔗 Base URL: https://senalytdl.vercel.app/
🎥 Endpoints:
- /mp3?id=VIDEO_ID
- /download?id=VIDEO_ID&format=FORMAT
Available formats: ${formats.join(", ")}
          `.trim()
        }, { quoted: mek });
      }
    } catch (err) {
      console.error("YT Video button error:", err);
    }
  });
});
