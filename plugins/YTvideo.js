const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB limit
const sessions = {};

async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

async function sendVideo(robin, from, mek, buffer, title) {
  await robin.ws.refreshMediaConn(true);
  await robin.sendMessage(
    from,
    {
      video: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: `🎬 *${title}*`,
    },
    { quoted: mek }
  );
}

async function sendDocument(robin, from, mek, buffer, title) {
  await robin.ws.refreshMediaConn(true);
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "✅ *Document sent by SENAL MD* 🎥",
    },
    { quoted: mek }
  );
}

// 📥 .video command
cmd(
  {
    pattern: "video",
    desc: "📥 Download YouTube video",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    try {
      if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

      await reply("🔎 Searching for your video...");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Video not found. Try again.*");

      await reply("⏬ Fetching download link...");

      const result = await ytmp4(video.url);
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      const buffer = await downloadFile(result.download.url);
      const filesize = buffer.length;
      const filesizeMB = (filesize / 1024 / 1024).toFixed(2);

      // Save session
      sessions[from] = {
        video,
        buffer,
        filesize,
        quoted: mek,
      };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
📦 *Size:* ${filesizeMB} MB
🔗 *URL:* ${video.url}

📁 *Choose file type:*
1️⃣ Video (Play)
2️⃣ Document (File)

✍️ _Reply with 1 or 2_
`;

      await robin.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption: info,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("YT Video Error:", err);
      return reply("❌ *Error while downloading video. Try again later.*");
    }
  }
);

// 🔁 Global reply handler
cmd(
  {
    on: "message",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const text = m.text?.trim();
    if (!["1", "2"].includes(text)) return;

    const session = sessions[from];
    if (!session) return;

    try {
      if (text === "1") {
        // Send as video
        if (session.filesize > MAX_VIDEO_SIZE) {
          await reply("⚠️ *File too large for inline video. Sending as document...*");
          await sendDocument(robin, from, session.quoted, session.buffer, session.video.title);
        } else {
          await reply("📤 Uploading video...");
          await sendVideo(robin, from, session.quoted, session.buffer, session.video.title);
        }
      } else if (text === "2") {
        // Send as document
        await reply("📤 Uploading document...");
        await sendDocument(robin, from, session.quoted, session.buffer, session.video.title);
      }

      await reply("✅ *Sent successfully!*");
    } catch (err) {
      console.error("Send error:", err);
      await reply("❌ *Failed to send the file.*");
    }

    delete sessions[from];
  }
);
