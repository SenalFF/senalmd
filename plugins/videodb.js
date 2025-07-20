const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB for inline
const sessions = {};

// Stream fetcher (no buffer)
async function getVideoStream(url) {
  const res = await axios.get(url, { responseType: "stream" });
  return {
    stream: res.data,
    size: Number(res.headers["content-length"]),
    mime: res.headers["content-type"] || "video/mp4",
  };
}

// Send video inline
async function sendVideo(robin, from, mek, stream, title, mime) {
  await robin.sendMessage(
    from,
    {
      video: { stream },
      mimetype: mime,
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: `🎬 *${title}*`,
    },
    { quoted: mek }
  );
}

// Send as document
async function sendDocument(robin, from, mek, stream, title, mime) {
  await robin.sendMessage(
    from,
    {
      document: { stream },
      mimetype: mime,
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "✅ *Document sent by SENAL MD* 🎥",
    },
    { quoted: mek }
  );
}

// ▶️ .video command
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
🔹 *vid1* - Send as Video
🔹 *vid2* - Send as Document

✍️ _Reply with *video1* or *video2*_
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
      return reply("❌ *Error while searching video. Try again later.*");
    }
  }
);

// 📽️ video1: send inline video
cmd(
  {
    pattern: "vid1",
    desc: "Send YouTube video inline",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";

    try {
      await reply("⏬ Fetching video download link...");
      const result = await ytmp4(session.video.url, "360");
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      await reply("📡 Opening video stream...");
      const { stream, size, mime } = await getVideoStream(result.download.url);

      if (size > MAX_VIDEO_SIZE) {
        await reply(`⚠️ File is ${(size / 1024 / 1024).toFixed(2)} MB — sending as document instead.`);
        await sendDocument(robin, from, mek, stream, session.video.title, mime);
      } else {
        await reply("📤 Uploading video...");
        await sendVideo(robin, from, mek, stream, session.video.title, mime);
      }

      await reply("✅ *Video sent successfully!*");
    } catch (err) {
      console.error("Video1 send error:", err);
      await reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// 📁 video2: send as document
cmd(
  {
    pattern: "vid2",
    desc: "Send YouTube video as document",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";

    try {
      await reply("⏬ Fetching video download link...");
      const result = await ytmp4(session.video.url, "360");
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      await reply("📡 Opening video stream...");
      const { stream, size, mime } = await getVideoStream(result.download.url);

      const sizeMB = (size / 1024 / 1024).toFixed(2);
      const urlHost = new URL(result.download.url).hostname;

      await reply(`📁 Preparing File...

🎞️ *Title:* ${session.video.title}
📦 *Size:* ${sizeMB} MB
📄 *Type:* ${mime}
🌐 *Source:* ${urlHost}

📤 Uploading to WhatsApp...
`);

      await sendDocument(robin, from, mek, stream, session.video.title, mime);
      await reply("✅ *Document sent successfully!* 🎉");
    } catch (err) {
      console.error("Video2 send error:", err);
      await reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
