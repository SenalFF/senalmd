const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

// Available formats
const formats = ["144", "240", "360", "480", "720", "1080", "mp3"];

cmd({
  pattern: "video",
  desc: "📹 Download YouTube Video or Audio via Senal YT DL",
  category: "download",
  react: "📹",
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗Please provide a YouTube link or video name.");

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

    // Dynamic buttons for each format
    const buttons = formats.map(f => ({
      buttonId: `dl_${data.videoId}_${f}`,
      buttonText: { displayText: f === "mp3" ? "🎵 MP3" : `${f}p` },
      type: 1
    }));

    // Add API info button
    buttons.push({ buttonId: "api_info_vid", buttonText: { displayText: "ℹ️ API Info" }, type: 1 });

    await conn.sendMessage(from, {
      image: { url: data.thumbnail },
      caption,
      footer: "🚀 Powered by Senal YT DL",
      buttons,
      headerType: 4
    }, { quoted: mek });

  } catch (err) {
    console.error(err);
    reply("❌ An error occurred while processing your video.");
  }
});

// === GLOBAL BUTTON LISTENER for Video & Audio ===
conn.ev.on("messages.upsert", async (msg) => {
  try {
    const m = msg.messages[0];
    if (!m) return;

    const btn = m.message?.buttonsResponseMessage?.selectedButtonId;
    if (!btn) return;

    // Download / Play Video or Audio
    if (btn.startsWith("dl_")) {
      const [ , videoId, format ] = btn.split("_");
      const apiUrl = format === "mp3"
        ? `https://senalytdl.vercel.app/mp3?id=${videoId}`
        : `https://senalytdl.vercel.app/download?id=${videoId}&format=${format}`;

      const { data: res } = await axios.get(apiUrl);
      if (!res.downloadUrl) return;

      if (format === "mp3") {
        // Send audio document + play
        await conn.sendMessage(m.key.remoteJid, { audio: { url: res.downloadUrl }, mimetype: "audio/mpeg" }, { quoted: m });
        await conn.sendMessage(m.key.remoteJid, {
          document: { url: res.downloadUrl },
          mimetype: "audio/mpeg",
          fileName: `${res.title}.mp3`,
          caption: "✅ MP3 sent by *Mr Senal*"
        }, { quoted: m });
      } else {
        // Send video document + playable
        await conn.sendMessage(m.key.remoteJid, { video: { url: res.downloadUrl }, mimetype: "video/mp4" }, { quoted: m });
        await conn.sendMessage(m.key.remoteJid, {
          document: { url: res.downloadUrl },
          mimetype: "video/mp4",
          fileName: `${res.title}_${format}.mp4`,
          caption: `✅ Video ${format}p sent by *Mr Senal*`
        }, { quoted: m });
      }
    }

    // API Info button
    if (btn === "api_info_vid") {
      await conn.sendMessage(m.key.remoteJid, {
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
      }, { quoted: m });
    }

  } catch (err) {
    console.error("Button listener error:", err);
  }
});
