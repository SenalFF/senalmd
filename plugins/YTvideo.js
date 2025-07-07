const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 45 * 1024 * 1024;
const sessions = {};

// Download video as buffer
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

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

// Main .ytvideo command
cmd(
  {
    pattern: "ytvideo",
    desc: "📥 YouTube Video Downloader",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;

    if (!q) return reply("🔍 *Please provide a YouTube video name or link.*");

    try {
      await reply("🔎 Searching YouTube...");
      const search = await yts(q);
      const video = search.videos[0];
      if (!video) return reply("❌ *No video found. Try another keyword.*");

      sessions[from] = {
        step: "waiting_reply",
        video,
        originalKey: mek.key,
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
      reply("❌ *Error occurred while searching.*");
    }
  }
);

// Listener for reply "1" or "2"
cmd(
  {
    pattern: ".*",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { body, reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];

    if (!session || session.step !== "waiting_reply") return;
    if (!["1", "2"].includes(body.trim())) return;

    const { video, originalKey } = session;
    delete sessions[from]; // prevent multiple use

    try {
      await robin.sendMessage(from, { react: { text: body === "1" ? "📹" : "📄", key: mek.key } });
      await reply("⏬ Downloading...");

      const result = await ytmp4(video.url); // default 360p
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      const buffer = await downloadFile(result.download.url);
      const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);

      if (body.trim() === "1") {
        if (buffer.length > MAX_VIDEO_SIZE) {
          await reply(`⚠️ *File too big (${sizeMB}MB). Sending as document...*`);
          await sendDocument(robin, from, mek, buffer, video.title);
        } else {
          await sendVideo(robin, from, mek, buffer, video.title);
        }
      } else {
        await sendDocument(robin, from, mek, buffer, video.title);
      }

      await reply("✅ *Video sent successfully!*");
    } catch (err) {
      console.error("Send video/doc error:", err);
      await reply("❌ *Failed to send video/document.*");
    }
  }
);
