const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const sessions = {};

// Helper to download buffer from URL
async function fetchBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// Send inline video
async function sendVideo(sock, from, mek, buffer, title) {
  return await sock.sendMessage(
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

// Send video as document
async function sendDocument(sock, from, mek, buffer, title) {
  return await sock.sendMessage(
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
    desc: "🎥 YouTube Video Downloader (no save, select type)",
    category: "download",
    react: "🎞️",
  },
  async (sock, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 කරුණාකර YouTube වීඩියෝ නමක් හෝ ලින්ක් එකක් ලබාදෙන්න.");

      await reply("🔎 Searching...");

      const results = await yts(q);
      const video = results.videos[0];
      if (!video) return reply("❌ Video not found.");

      await reply("⏬ Getting download link...");

      const result = await ytmp4(video.url, "360");
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      const buffer = await fetchBuffer(result.download.url);
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

      // Save session temporarily
      sessions[from] = {
        video,
        buffer,
        sizeMB,
        step: "file_type_select",
      };

      const thumb = await axios.get(video.thumbnail, { responseType: "arraybuffer" });

      const caption = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ Duration: ${video.timestamp}
👁️ Views: ${video.views.toLocaleString()}
📤 Uploaded: ${video.ago}
📦 File Size: ${sizeMB} MB

✍️ Reply with:
1️⃣ Send as Video
2️⃣ Send as Document
      `.trim();

      await sock.sendMessage(
        from,
        {
          image: thumb.data,
          caption,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("Video Error:", err);
      await reply("❌ Error occurred while getting the video.");
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
    if (!session || session.step !== "file_type_select") return;

    const { video, buffer, sizeMB } = session;
    session.step = "sending";

    try {
      if (buffer.length > MAX_SIZE) {
        await reply(`⚠️ Video is ${sizeMB} MB — too large for inline video.\nSending as document...`);
        await sendDocument(sock, from, mek, buffer, video.title);
      } else {
        await reply("📤 Sending video...");
        await sendVideo(sock, from, mek, buffer, video.title);
      }
      await reply("✅ Done!");
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
    if (!session || session.step !== "file_type_select") return;

    const { video, buffer } = session;
    session.step = "sending";

    try {
      await reply("📤 Sending document...");
      await sendDocument(sock, from, mek, buffer, video.title);
      await reply("✅ Done!");
    } catch (err) {
      console.error("Send document error:", err);
      await reply("❌ Failed to send document.");
    }

    delete sessions[from];
  }
);
