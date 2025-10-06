const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

const formats = ["144", "240", "360", "480", "720", "1080"];

// Module-level flag to ensure event listener is registered only once
let listenerRegistered = false;

cmd({
  pattern: "video",
  desc: "📹 Download YouTube Video via Senal YT DL",
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

    // Buttons for available formats (video only)
    const buttons = formats.map(f => ({
      buttonId: `dl_${data.videoId}_${f}`,
      buttonText: { displayText: `${f}p` },
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

  // Register the global event listener only once (on first command execution)
  if (!listenerRegistered) {
    listenerRegistered = true;
    console.log("📡 Registering YT Video button event listener...");

    conn.ev.on("messages.upsert", async (messageUpdate) => {
      const mek = messageUpdate.messages[0];
      if (!mek?.message?.buttonsResponseMessage || mek.key.fromMe) return;

      const btnId = mek.message.buttonsResponseMessage.selectedButtonId;
      if (!btnId) return;

      const remoteJid = mek.key.remoteJid;

      try {
        if (btnId.startsWith("dl_")) {
          const [, videoId, format] = btnId.split("_");

          const apiUrl = `https://senalytdl.vercel.app/download?id=${videoId}&format=${format}`;

          const { data: res } = await axios.get(apiUrl);
          if (!res.downloadUrl) return conn.sendMessage(remoteJid, { text: "❌ Download URL not available." }, { quoted: mek });

          // Fallback to search for title if API doesn't provide it
          let title = res.title;
          if (!title) {
            const search = await yts(`https://www.youtube.com/watch?v=${videoId}`);
            const data = search.videos[0];
            title = data?.title || "Unknown Title";
          }

          // Send both video (playable) and document (downloadable)
          await conn.sendMessage(remoteJid, { 
            video: { url: res.downloadUrl }, 
            mimetype: "video/mp4" 
          }, { quoted: mek });
          await conn.sendMessage(remoteJid, { 
            document: { url: res.downloadUrl }, 
            mimetype: "video/mp4", 
            fileName: `${title}_${format}.mp4`, 
            caption: `✅ Video ${format}p sent by *Mr Senal*` 
          }, { quoted: mek });
        }

        if (btnId === "api_info_vid") {
          await conn.sendMessage(remoteJid, {
            text: `
🧠 *Senal YT DL API Info*
👨‍💻 Developer: Mr Senal
📦 Project: Senal YT DL v2.0
🔗 Base URL: https://senalytdl.vercel.app/
🎥 Endpoints:
- /download?id=VIDEO_ID&format=FORMAT
Available formats: ${formats.join(", ")}
            `.trim()
          }, { quoted: mek });
        }
      } catch (err) {
        console.error("YT Video button error:", err);
        conn.sendMessage(remoteJid, { text: "❌ An error occurred during download." }, { quoted: mek });
      }
    });
  }
});
