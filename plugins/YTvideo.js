const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const sessions = {};

// 🔽 Download video
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// 🎥 Send as inline video
async function sendVideo(robin, from, mek, buffer, title) {
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

// 📄 Send as document
async function sendDocument(robin, from, mek, buffer, title) {
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

// ▶️ Main command
cmd(
  {
    pattern: "video",
    desc: "📥 YouTube Video Downloader",
    category: "download",
    react: "📹",
    filename: __filename,
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;

    if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

    try {
      await reply("🔎 Searching YouTube...");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Video not found!*");

      const filesizeMB = video.seconds > 600 ? "⚠️ *Warning: Long video, size may exceed limits.*" : "";

      sessions[from] = {
        step: "waiting_reply",
        video,
      };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}
${filesizeMB}

📁 *Choose file type:*
1️⃣ Video (Play Inline)
2️⃣ Document (File Download)

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
      console.error("Video cmd error:", err);
      reply("❌ *Error occurred, try again later.*");
    }
  }
);

// 🔁 Reply with 1 (Video)
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];

    if (!session || session.step !== "waiting_reply") return;

    try {
      await reply("⏬ Downloading video...");

      const res = await ytmp4(session.video.url, "360");
      if (!res?.download?.url) return reply("❌ Couldn't get video download URL.");

      const buffer = await downloadFile(res.download.url);
      const size = buffer.length;

      if (size > MAX_VIDEO_SIZE) {
        await reply("⚠️ *File too big for inline play. Sending as document...*");
        await sendDocument(robin, from, mek, buffer, session.video.title);
      } else {
        await sendVideo(robin, from, mek, buffer, session.video.title);
      }

      await reply("✅ *Sent successfully!*");
    } catch (e) {
      console.error("Video1 send error:", e);
      await reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// 🔁 Reply with 2 (Document)
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];

    if (!session || session.step !== "waiting_reply") return;

    try {
      await reply("⏬ Downloading video as document...");

      const res = await ytmp4(session.video.url, "360");
      if (!res?.download?.url) return reply("❌ Couldn't get video download URL.");

      const buffer = await downloadFile(res.download.url);
      await sendDocument(robin, from, mek, buffer, session.video.title);

      await reply("✅ *Document sent!*");
    } catch (e) {
      console.error("Video2 send error:", e);
      await reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
