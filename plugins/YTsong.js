const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { uploadAndGetBuffer } = require("../lib/senaldb"); // ✅ GoFile uploader

const MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16MB
const sessions = {};

// Send as voice/audio
async function sendAudio(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      audio: buffer,
      mimetype: "audio/mpeg",
      fileName: `${title.slice(0, 30)}.mp3`,
    },
    { quoted: mek }
  );
}

// Send as document
async function sendDocument(robin, from, mek, buffer, title, mimeType = "audio/mpeg") {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: mimeType,
      fileName: `${title.slice(0, 30)}.mp3`,
      caption: "✅ *Document sent by SENAL MD* ❤️",
    },
    { quoted: mek }
  );
}

// .play command
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

      const fileName = `${video.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}.mp3`;
      const filePath = path.join(__dirname, "..", "downloads", fileName);

      // Save file to disk
      const writer = fs.createWriteStream(filePath);
      const audioStream = await axios.get(result.download.url, { responseType: "stream" });
      await new Promise((resolve, reject) => {
        audioStream.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      // Upload and get buffer from SenalDB
      const { buffer, mimeType } = await uploadAndGetBuffer(filePath);
      const filesize = buffer.length;
      const filesizeMB = (filesize / (1024 * 1024)).toFixed(2);

      sessions[from] = {
        video,
        buffer,
        mimeType,
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

// Reply: 1️⃣ Audio
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";

    try {
      if (session.filesize > MAX_AUDIO_SIZE) {
        await reply(
          `⚠️ *Audio file is too large (${(session.filesize / (1024 * 1024)).toFixed(2)} MB) for voice note.*\n` +
            `Sending as document instead...`
        );
        await sendDocument(robin, from, mek, session.buffer, session.video.title, session.mimeType);
        await reply("✅ *Document sent successfully!* 📄");
      } else {
        await reply("⏳ Uploading audio as voice note...");
        await sendAudio(robin, from, mek, session.buffer, session.video.title);
        await reply("✅ *Audio sent successfully!* 🎧");
      }
    } catch (e) {
      console.error("Audio send error:", e);
      await reply("❌ *Failed to send audio/document. Please try again later.*");
    }

    delete sessions[from];
  }
);

// Reply: 2️⃣ Document
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";

    try {
      await reply("⏳ Uploading audio as document...");
      await sendDocument(robin, from, mek, session.buffer, session.video.title, session.mimeType);
      await reply("✅ *Document sent successfully!* 📄");
    } catch (e) {
      console.error("Document send error:", e);
      await reply("❌ *Failed to send document. Please try again later.*");
    }

    delete sessions[from];
  }
);
