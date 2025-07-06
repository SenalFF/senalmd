const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const sessions = {};

// Download video buffer
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// Send as video
async function sendVideo(sock, from, mek, buffer, title) {
  await sock.sendMessage(
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

// Send as document
async function sendDocument(sock, from, mek, buffer, title) {
  await sock.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "✅ *Sent by SENAL MD* ❤️",
    },
    { quoted: mek }
  );
}

// .video command
cmd(
  {
    pattern: "video",
    desc: "📥 YouTube Video Downloader (Select File Type)",
    category: "download",
    react: "🎞️",
  },
  async (sock, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 කරුණාකර YouTube වීඩියෝ නමක් හෝ ලින්ක් එකක් ලබාදෙන්න.");

      await reply("🔎 Searching YouTube...");

      const result = await yts(q);
      const video = result.videos[0];
      if (!video) return reply("❌ Video not found.");

      await reply("📥 Downloading best quality (auto)...");

      const res = await ytmp4(video.url, "360"); // use 360p for better speed
      if (!res?.download?.url) return reply("❌ Failed to get download link.");

      const buffer = await downloadFile(res.download.url);
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

      // Store in session
      sessions[from] = {
        buffer,
        filesize: buffer.length,
        video,
        step: "choose_type",
      };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ Duration: ${video.timestamp}
👁️ Views: ${video.views.toLocaleString()}
📤 Uploaded: ${video.ago}
📦 File Size: ${sizeMB} MB
🔗 URL: ${video.url}

✍️ *Reply with:*
1️⃣ Video (inline)
2️⃣ Document (file)

⚠️ *If video is large, it's better to use Document.*
      `.trim();

      const thumbnail = await axios.get(video.thumbnail, { responseType: "arraybuffer" });

      await sock.sendMessage(
        from,
        {
          image: thumbnail.data,
          caption: info,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("Video error:", err);
      await reply("❌ Error occurred while processing the video.");
    }
  }
);

// 1️⃣ Send as video
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (sock, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_type") return;

    session.step = "sending";

    try {
      const { buffer, video } = session;
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

      if (buffer.length > MAX_VIDEO_SIZE) {
        await reply(`⚠️ Video is ${sizeMB} MB. Sending as document instead...`);
        await sendDocument(sock, from, mek, buffer, video.title);
      } else {
        await reply("📤 Uploading as video...");
        await sendVideo(sock, from, mek, buffer, video.title);
      }

      await reply("✅ Video sent successfully!");
    } catch (err) {
      console.error("Send video error:", err);
      await reply("❌ Failed to send video.");
    }

    delete sessions[from];
  }
);

// 2️⃣ Send as document
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (sock, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_type") return;

    session.step = "sending";

    try {
      const { buffer, video } = session;

      await reply("📤 Uploading as document...");
      await sendDocument(sock, from, mek, buffer, video.title);
      await reply("✅ Document sent successfully!");
    } catch (err) {
      console.error("Send document error:", err);
      await reply("❌ Failed to send document.");
    }

    delete sessions[from];
  }
);
