const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 45 * 1024 * 1024; // 45MB
const sessions = {};

// 🟢 Download video buffer
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// 🎬 Send as video (inline playback)
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
      caption: "📄 *Video file sent by SENAL MD*",
    },
    { quoted: mek }
  );
}

// ▶️ Main .ytvideo command
cmd(
  {
    pattern: "ytvideo",
    desc: "📥 YouTube Video Downloader",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    if (!q) return reply("🔍 *Please provide a video name or YouTube link.*");

    try {
      await reply("🔎 Searching YouTube...");
      const search = await yts(q);
      const video = search.videos[0];
      if (!video) return reply("❌ *Video not found. Try a different name.*");

      sessions[from] = {
        step: "choose_format",
        video,
      };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

📁 *Choose file type:*
1️⃣ Send as Video
2️⃣ Send as Document

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
      console.error("YT Search Error:", err);
      return reply("❌ *Error searching video.*");
    }
  }
);

// 🟡 Handle reply 1 (send video)
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    try {
      await robin.sendMessage(from, { react: { text: "📹", key: mek.key } });

      await reply("⏬ Downloading video...");
      const result = await ytmp4(session.video.url); // 360p default
      if (!result?.download?.url) return reply("❌ *Failed to get download link.*");

      const buffer = await downloadFile(result.download.url);
      const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);

      if (buffer.length > MAX_VIDEO_SIZE) {
        await reply(`⚠️ File too big (${sizeMB}MB). Sending as document...`);
        await sendDocument(robin, from, mek, buffer, session.video.title);
      } else {
        await reply("📤 Sending video...");
        await sendVideo(robin, from, mek, buffer, session.video.title);
      }

      await reply("✅ *Sent successfully!*");
    } catch (err) {
      console.error("Video send error:", err);
      await reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// 🟡 Handle reply 2 (send document)
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    try {
      await robin.sendMessage(from, { react: { text: "📄", key: mek.key } });

      await reply("⏬ Downloading document...");
      const result = await ytmp4(session.video.url); // 360p default
      if (!result?.download?.url) return reply("❌ *Failed to get download link.*");

      const buffer = await downloadFile(result.download.url);

      await reply("📤 Sending document...");
      await sendDocument(robin, from, mek, buffer, session.video.title);

      await reply("✅ *Document sent successfully!*");
    } catch (err) {
      console.error("Doc send error:", err);
      await reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
