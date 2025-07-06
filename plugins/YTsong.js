const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16 MB
const sessions = {};

// Format file size from bytes to GB/MB/KB/B
function formatFileSize(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
  return bytes + " B";
}

// Download audio buffer
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// Send as audio voice note
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
async function sendDocument(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "audio/mpeg",
      fileName: `${title.slice(0, 30)}.mp3`,
      caption: "✅ *🎧 Document sent by SENAL MD* ❤️",
    },
    { quoted: mek }
  );
}

// PLAY command
cmd(
  {
    pattern: "play",
    desc: "🎧 YouTube Audio Downloader with format choice",
    category: "download",
    react: "🎧",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🎯 *කරුණාකර ගීත නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න...*");

      await reply("🔍 Searching song 🎶");
      await new Promise(res => setTimeout(res, 1000));
      await reply("🔎 Getting video info... ⏳");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Song not found. Try different keywords.*");

      await reply("📥 Downloading audio details... ⏬");

      const result = await ytmp3(video.url, "mp3");
      if (!result?.download?.url) return reply("❌ *Could not fetch download link.*");

      await reply("🌀 Downloading audio file, please wait...");

      const buffer = await downloadFile(result.download.url);
      const filesize = buffer.length;
      const filesizeReadable = formatFileSize(filesize);

      sessions[from] = {
        video,
        buffer,
        filesize,
        step: "choose_format",
      };

      const info = `
🎧 *SENAL MD Song Downloader*

🎵 *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
📦 *Size:* ${filesizeReadable}
🔗 *URL:* ${video.url}

📁 *Choose file format to receive:*
1️⃣ Audio (Voice note)
2️⃣ Document (File)

✍️ _Reply with 1 or 2_
⚠️ _Audio files over 16 MB will be sent as documents_
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

// AUDIO choice (1)
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
        await reply(`⚠️ *Audio file too big for voice note.*\n📤 Sending as document...`);
        await sendDocument(robin, from, mek, session.buffer, session.video.title);
        await reply("✅ *Document sent successfully!* 📄");
      } else {
        await reply("🚀 Uploading audio as voice note...");
        await sendAudio(robin, from, mek, session.buffer, session.video.title);
        await reply("✅ *Audio sent successfully!* 🔊");
      }
    } catch (e) {
      console.error("Send Audio/Doc Error:", e);
      await reply("❌ *Failed to send audio. Try again later.*");
    }

    delete sessions[from];
  }
);

// DOCUMENT choice (2)
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
      await reply("📤 Uploading audio as document...");
      await sendDocument(robin, from, mek, session.buffer, session.video.title);
      await reply("✅ *Document sent successfully!* 🎉");
    } catch (e) {
      console.error("Send Doc Error:", e);
      await reply("❌ *Failed to send document. Try again later.*");
    }

    delete sessions[from];
  }
);
