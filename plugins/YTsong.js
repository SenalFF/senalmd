const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16 MB WhatsApp audio limit
const sessions = {};

async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

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

async function sendDocument(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "audio/mpeg",
      fileName: `${title.slice(0, 30)}.mp3`,
      caption: "✅ *Document sent by SENAL MD* ❤️",
    },
    { quoted: mek }
  );
}

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

      // Download file once, buffer cache
      const buffer = await downloadFile(result.download.url);

      // Measure size from actual buffer
      const filesize = buffer.length;

      sessions[from] = {
        video,
        buffer,
        filesize,
        step: "choose_format",
      };

      const filesizeMB = (filesize / (1024 * 1024)).toFixed(2);

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
        await sendDocument(robin, from, mek, session.buffer, session.video.title);
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
      await sendDocument(robin, from, mek, session.buffer, session.video.title);
      await reply("✅ *Document sent successfully!* 📄");
    } catch (e) {
      console.error("Document send error:", e);
      await reply("❌ *Failed to send document. Please try again later.*");
    }

    delete sessions[from];
  }
);
