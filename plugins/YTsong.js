const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16 MB WhatsApp limit for audio files
const sessions = {};

cmd(
  {
    pattern: "play",
    desc: "🎧 YouTube Audio Downloader with format choice",
    category: "download",
    react: "🎧",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 *කරුණාකර ගීත නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

      await reply("🔎 Searching for your song... 🎶");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Sorry, no song found. Try another keyword!*");

      await reply("⬇️ Fetching audio info... ⏳");

      const result = await ytmp3(video.url, "mp3");
      if (!result?.download?.url) return reply("⚠️ *Could not fetch the download link. Try again later.*");

      // Get file size in bytes, fallback if unavailable
      let filesize = result.filesize || result.filesizeRaw || 0;
      if (typeof filesize === "string") filesize = parseInt(filesize);

      // Convert bytes to MB for display
      const filesizeMB = (filesize / (1024 * 1024)).toFixed(2);

      sessions[from] = {
        video,
        downloadUrl: result.download.url,
        filesize,
        step: "choose_format",
      };

      const info = `
🎧 *SENAL MD Song Downloader*

🎶 *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
📦 *File Size:* ${filesizeMB} MB
🔗 *URL:* ${video.url}

📁 *Select the format you want to receive:*
1️⃣ Audio (Voice note)
2️⃣ Document (File)

✍️ _Please reply with 1 or 2_

⚠️ _Note: Audio voice notes have a max size of 16 MB on WhatsApp._
`;

      // Send thumbnail + info + format request
      await robin.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption: info,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error("Play Command Error:", e);
      return reply(`❌ *Error:* ${e.message}`);
    }
  }
);

// Handle user reply: choose audio or document
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    try {
      // If file size exceeds limit, force sending as document instead of audio
      if (session.filesize > MAX_AUDIO_SIZE) {
        await reply(
          `⚠️ *Audio file is too large (${(session.filesize / (1024 * 1024)).toFixed(2)} MB) for voice note.*\n` +
            `Sending as document instead...`
        );

        await robin.sendMessage(
          from,
          {
            document: { url: session.downloadUrl },
            mimetype: "audio/mpeg",
            fileName: `${session.video.title.slice(0, 30)}.mp3`,
            caption: "✅ *Document sent by SENAL MD* ❤️",
          },
          { quoted: mek }
        );
        await reply("✅ *Document sent successfully!* 📄");
      } else {
        await reply("⏳ Uploading audio as voice note...");
        const res = await axios.get(session.downloadUrl, { responseType: "arraybuffer" });
        const buffer = Buffer.from(res.data);

        await robin.sendMessage(
          from,
          {
            audio: buffer,
            mimetype: "audio/mpeg",
            fileName: `${session.video.title.slice(0, 30)}.mp3`,
          },
          { quoted: mek }
        );
        await reply("✅ *Audio sent successfully!* 🎧");
      }
    } catch (e) {
      console.error("Audio send error:", e);
      await reply("❌ *Failed to send audio/document. Please try again later.*");
    }

    delete sessions[from];
  }
);

cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    try {
      await reply("⏳ Uploading audio as document...");

      await robin.sendMessage(
        from,
        {
          document: { url: session.downloadUrl },
          mimetype: "audio/mpeg",
          fileName: `${session.video.title.slice(0, 30)}.mp3`,
          caption: "✅ *Document sent by SENAL MD* ❤️",
        },
        { quoted: mek }
      );

      await reply("✅ *Document sent successfully!* 📄");
    } catch (e) {
      console.error("Document send error:", e);
      await reply("❌ *Failed to send document. Please try again later.*");
    }

    delete sessions[from];
  }
);
