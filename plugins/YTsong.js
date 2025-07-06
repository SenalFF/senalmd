const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper");
const axios = require("axios");

global.pendingFormat = {}; // For tracking button selections

cmd(
  {
    pattern: "play",
    react: "🎧",
    desc: "Search YouTube and choose format",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔎 *කරුණාකර ගීත නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ ගීතය හමු නොවීය.");

      const result = await ytmp3(video.url, "mp3");
      if (!result?.download?.url) return reply("⚠️ ගීතය බාගත කළ නොහැක.");

      // Save data to global pending format store
      global.pendingFormat[from] = {
        video,
        downloadUrl: result.download.url,
        title: video.title,
      };

      const caption = `
🎧 *SENAL MD Song Downloader*

🎶 *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

📥 *Select Format Below*
`;

      // Send message with buttons
      await robin.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption,
          footer: "Powered by Mr Senal",
          buttons: [
            { buttonId: "audio", buttonText: { displayText: "🎧 Audio" }, type: 1 },
            { buttonId: "doc", buttonText: { displayText: "📄 Document" }, type: 1 },
          ],
          headerType: 4,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error("Play Error:", e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);

// Handle button reply
cmd(
  {
    pattern: "^(audio|doc)$",
    only: "text",
    filename: __filename,
  },
  async (robin, mek, m, { from, body, reply }) => {
    const pending = global.pendingFormat[from];
    if (!pending) return reply("❌ No pending song. Use `.play <song name>` first.");

    const { downloadUrl, title } = pending;

    try {
      const res = await axios.get(downloadUrl, { responseType: "arraybuffer" });
      const buffer = Buffer.from(res.data);
      const fileName = `${title.slice(0, 30)}.mp3`;

      if (body === "audio") {
        await robin.sendMessage(
          from,
          {
            audio: buffer,
            mimetype: "audio/mpeg",
            fileName,
          },
          { quoted: mek }
        );
        reply("✅ *Audio sent!*");
      } else if (body === "doc") {
        await robin.sendMessage(
          from,
          {
            document: buffer,
            mimetype: "audio/mpeg",
            fileName,
          },
          { quoted: mek }
        );
        reply("✅ *Document sent!*");
      }

      delete global.pendingFormat[from]; // Cleanup
    } catch (err) {
      console.error("Send Error:", err);
      reply("❌ Error sending the file.");
    }
  }
);
