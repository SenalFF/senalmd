const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_INLINE_SIZE = 50 * 1024 * 1024; // 50MB inline limit
const sessions = {};

// Helper: Get file size (MB) from HEAD request
async function getFileSize(url) {
  try {
    const res = await axios.head(url);
    const length = res.headers["content-length"];
    if (length) return (Number(length) / 1024 / 1024).toFixed(2);
  } catch {
    // ignore error
  }
  return null;
}

// Stream fetcher (no buffer)
async function getVidStream(url) {
  const res = await axios.get(url, { responseType: "stream" });
  return {
    stream: res.data,
    size: Number(res.headers["content-length"]),
    mime: res.headers["content-type"] || "video/mp4",
    host: new URL(url).hostname,
  };
}

// Send inline vid
async function sendVid(robin, from, mek, stream, title, mime) {
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
async function sendDocument(robin, from, mek, stream, title, mime, sizeMB, host) {
  const caption = `✅ *Document sent by SENAL MD* 🎥

🎞️ *Title:* ${title}
📦 *Size:* ${sizeMB} MB
📄 *Type:* ${mime}
🌐 *Source:* ${host}`;

  await robin.sendMessage(
    from,
    {
      document: { stream },
      mimetype: mime,
      fileName: `${title.slice(0, 30)}.mp4`,
      caption,
    },
    { quoted: mek }
  );
}

// ▶️ .vid command
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
      await reply("🔎 Searching for your vid...");

      const searchResult = await yts(q);
      const vid = searchResult.videos[0];
      if (!vid) return reply("❌ *Video not found. Try again.*");

      // Get download URL to fetch size
      const result = await ytmp4(vid.url, "360");
      let sizeMB = null;
      if (result?.download?.url) {
        sizeMB = await getFileSize(result.download.url);
      }

      sessions[from] = {
        vid,
        step: "choose_format",
      };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${vid.title}
⏱️ *Duration:* ${vid.timestamp}
👁️ *Views:* ${vid.views.toLocaleString()}
📤 *Uploaded:* ${vid.ago}
🔗 *URL:* ${vid.url}
📦 *Size:* ${sizeMB ? sizeMB + " MB" : "Unknown"}

📁 *Choose file type:*
🔹 *vid1* - Send as Video
🔹 *vid2* - Send as Document

✍️ _Reply with *vid1* or *vid2*_
`;

      await robin.sendMessage(
        from,
        {
          image: { url: vid.thumbnail },
          caption: info,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("YT Vid Error:", err);
      reply("❌ *Error while searching vid. Try again later.*");
    }
  }
);

// 📽️ vid1: send inline video
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
      await reply("⏬ Getting video link...");
      const result = await ytmp4(session.vid.url, "360");
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      await reply("📡 Opening stream...");
      const { stream, size, mime, host } = await getVidStream(result.download.url);
      const sizeMB = (size / 1024 / 1024).toFixed(2);

      if (size > MAX_INLINE_SIZE) {
        await reply(`⚠️ *File is ${sizeMB} MB* — switching to document mode.`);
        await sendDocument(robin, from, mek, stream, session.vid.title, mime, sizeMB, host);
      } else {
        await reply("📤 Uploading video...");
        await sendVid(robin, from, mek, stream, session.vid.title, mime);
      }

      reply("✅ *Video sent successfully!*");
    } catch (err) {
      console.error("Vid1 send error:", err);
      reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// 📁 vid2: send as document
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
      await reply("⏬ Getting video link...");
      const result = await ytmp4(session.vid.url, "360");
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      await reply("📡 Opening stream...");
      const { stream, size, mime, host } = await getVidStream(result.download.url);
      const sizeMB = (size / 1024 / 1024).toFixed(2);

      await reply(`📁 Preparing to send...

🎞️ *Title:* ${session.vid.title}
📦 *Size:* ${sizeMB} MB
📄 *Type:* ${mime}
🌐 *Host:* ${host}
`);

      await sendDocument(robin, from, mek, stream, session.vid.title, mime, sizeMB, host);
      reply("✅ *Document sent successfully!*");
    } catch (err) {
      console.error("Vid2 send error:", err);
      reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
