const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper");
const axios = require("axios");

global.pendingFormat = {}; // 🔁 Store pending users temporarily

cmd(
  {
    pattern: "play",
    react: "🎧",
    desc: "Search YouTube & choose format",
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

      const info = `
🎧 *SENAL MD Song Downloader*

🎶 *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

🎵 *Choose Format*:
1. Audio (voice type)
2. Document (file type)

_✍️ Reply with number 1 or 2_
`;

      // Save pending format request for this user
      global.pendingFormat[from] = {
        video,
        downloadUrl: result.download.url,
      };

      await robin.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption: info,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error("Play Error:", e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);

// 🧠 Listener for number reply (1 or 2)
cmd(
  {
    pattern: "^([1-2])$",
    only: "text",
    filename: __filename,
  },
  async (robin, mek, m, { from, body, reply }) => {
    const pending = global.pendingFormat[from];
    if (!pending) return; // No pending format request

    const { video, downloadUrl } = pending;

    try {
      const res = await axios.get(downloadUrl, { responseType: "arraybuffer" });
      const buffer = Buffer.from(res.data);
      const fileName = `${video.title.slice(0, 30)}.mp3`;

      if (body === "1") {
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
      } else if (body === "2") {
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

      delete global.pendingFormat[from]; // Clean up
    } catch (err) {
      console.error("Send Error:", err);
      reply("❌ Error sending the file.");
    }
  }
);
