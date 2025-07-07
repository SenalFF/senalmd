const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
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
      caption: "✅ *Video sent as document by SENAL MD* 🎥",
    },
    { quoted: mek }
  );
}

cmd(
  {
    pattern: "ytvideo",
    desc: "📥 YouTube Video Downloader",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    if (!q) return reply("🎬 *Enter a video title or YouTube URL!*");

    try {
      await reply("🔍 Searching video...");
      const search = await yts(q);
      const video = search.videos[0];
      if (!video) return reply("❌ *No video found.*");

      const result = await ytmp4(video.url, "360");
      if (!result?.download?.url) return reply("❌ *Could not get video download link.*");

      const buffer = await downloadFile(result.download.url);

      sessions[from] = {
        type: "video",
        video,
        buffer,
        step: "choose_format",
        filesize: buffer.length,
      };

      const info = `
🎥 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
📅 *Uploaded:* ${video.ago}
📦 *Size:* ${(buffer.length / 1024 / 1024).toFixed(2)} MB

📁 *Choose file type:*
1️⃣ Video (Play)
2️⃣ Document

✍️ _Reply with 1 or 2_
`;

      await robin.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption: info },
        { quoted: mek }
      );
    } catch (e) {
      console.error("ytvideo error:", e);
      reply("❌ *Error downloading video.*");
    }
  }
);

// Video: 1
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.type !== "video") return;

    try {
      if (session.filesize > MAX_VIDEO_SIZE) {
        await reply("⚠️ *Video too large. Sending as document...*");
        await sendDocument(robin, from, mek, session.buffer, session.video.title);
      } else {
        await reply("📤 Sending video...");
        await sendVideo(robin, from, mek, session.buffer, session.video.title);
      }

      await reply("✅ *Video sent successfully!*");
    } catch (e) {
      console.error("video send error:", e);
      reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// Video: 2
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.type !== "video") return;

    try {
      await reply("📤 Sending video as document...");
      await sendDocument(robin, from, mek, session.buffer, session.video.title);
      await reply("✅ *Document sent!*");
    } catch (e) {
      console.error("video doc error:", e);
      reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
