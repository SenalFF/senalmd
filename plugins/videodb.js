const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");
const uploadToGofile = require("../lib/upload");

const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
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

async function sendFromGofile(robin, from, mek, gofileUrl, title) {
  await robin.sendMessage(
    from,
    {
      document: { url: gofileUrl },
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: `✅ *Streamed from Gofile*`,
    },
    { quoted: mek }
  );
}

cmd(
  {
    pattern: "vid",
    desc: "📥 YouTube Video Downloader",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;

    if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

    try {
      await reply("🔎 Searching for your video...");
      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Video not found. Try again.*");

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
🔹 *get1* - Send as Video
🔹 *get2* - Send as Document

✍️ _Reply with *get1* or *get2*_
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
      reply("❌ *Error while searching. Try again later.*");
    }
  }
);

// ▶️ get1: Send as inline video
cmd(
  {
    pattern: "get1",
    desc: "Send YouTube video inline",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];

    if (!session || session.step !== "choose_format") {
      return reply("❌ *No video session found. Use .video first.*");
    }

    try {
      session.step = "sending";
      await reply("⏬ Downloading video...");
      const result = await ytmp4(session.video.url, "360");

      if (!result?.download?.url) return reply("❌ *Download link not found.*");

      const buffer = await downloadFile(result.download.url);
      const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
      await reply(`📦 *File size:* ${sizeMB} MB`);

      if (buffer.length > MAX_VIDEO_SIZE) {
        await reply("📤 File over 100MB — uploading to Gofile...");
        const upload = await uploadToGofile(buffer, `${session.video.title.slice(0, 30)}.mp4`);

        if (!upload.success) {
          console.error("Gofile upload failed:", upload.error);
          return reply("❌ *Gofile upload failed.*");
        }

        await reply("📨 Streaming from Gofile...");
        await sendFromGofile(robin, from, mek, upload.directUrl, session.video.title);
      } else {
        await reply("📤 Uploading to WhatsApp...");
        await sendVideo(robin, from, mek, buffer, session.video.title);
      }

      await reply("✅ *Done.*");
    } catch (err) {
      console.error("get1 error:", err);
      reply("❌ *Something went wrong.*");
    }

    delete sessions[from];
  }
);

// 📁 get2: Send as document
cmd(
  {
    pattern: "get2",
    desc: "Send YouTube video as document",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];

    if (!session || session.step !== "choose_format") {
      return reply("❌ *No video session found. Use .video first.*");
    }

    try {
      session.step = "sending";
      await reply("⏬ Downloading video...");
      const result = await ytmp4(session.video.url, "360");

      if (!result?.download?.url) return reply("❌ *Download link not found.*");

      const buffer = await downloadFile(result.download.url);
      const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
      await reply(`📦 *File size:* ${sizeMB} MB`);

      if (buffer.length > MAX_VIDEO_SIZE) {
        await reply("📤 File over 100MB — uploading to Gofile...");
        const upload = await uploadToGofile(buffer, `${session.video.title.slice(0, 30)}.mp4`);

        if (!upload.success) {
          console.error("Gofile upload failed:", upload.error);
          return reply("❌ *Gofile upload failed.*");
        }

        await reply("📨 Streaming from Gofile...");
        await sendFromGofile(robin, from, mek, upload.directUrl, session.video.title);
      } else {
        await reply("📤 Uploading document to WhatsApp...");
        await sendDocument(robin, from, mek, buffer, session.video.title);
      }

      await reply("✅ *Done.*");
    } catch (err) {
      console.error("get2 error:", err);
      reply("❌ *Something went wrong.*");
    }

    delete sessions[from];
  }
);
