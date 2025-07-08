const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 45 * 1024 * 1024;
const sessions = {};

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

// 🎬 MAIN VIDEO CMD
cmd(
  {
    pattern: "ytvideo",
    desc: "Download YouTube video",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 *Provide YouTube video name or link*");

      await reply("🔎 Searching...");
      const search = await yts(q);
      const video = search.videos[0];
      if (!video) return reply("❌ *No video found.*");

      // Save session — only video URL for now
      sessions[from] = {
        video,
        step: "choose_format",
      };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

📁 *Choose file type:*
1️⃣ Video (inline)
2️⃣ Document (file)

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
      reply("❌ *Error fetching video info.*");
    }
  }
);

// 📥 OPTION 1 — VIDEO
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
      const result = await ytmp4(session.video.url); // default 360p
      if (!result?.download?.url) return reply("❌ *Couldn't fetch video URL.*");

      const buffer = await downloadFile(result.download.url);

      if (buffer.length > MAX_VIDEO_SIZE) {
        await reply(`⚠️ File too big, sending as document...`);
        await sendDocument(robin, from, mek, buffer, session.video.title);
      } else {
        await reply("📤 Sending video...");
        await sendVideo(robin, from, mek, buffer, session.video.title);
      }

      await reply("✅ *Video sent!*");
    } catch (e) {
      console.error("Video send error:", e);
      reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// 📄 OPTION 2 — DOCUMENT
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
      const result = await ytmp4(session.video.url); // default 360p
      if (!result?.download?.url) return reply("❌ *Couldn't fetch video URL.*");

      const buffer = await downloadFile(result.download.url);

      await reply("📤 Sending document...");
      await sendDocument(robin, from, mek, buffer, session.video.title);
      await reply("✅ *Document sent!*");
    } catch (e) {
      console.error("Doc send error:", e);
      reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
