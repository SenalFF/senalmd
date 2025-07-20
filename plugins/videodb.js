const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_INLINE_SIZE = 50 * 1024 * 1024; // 50MB for inline videos
const sessions = {};

// Helper: get file size from URL using HEAD or Range GET requests
async function getSizeFromUrl(url) {
  try {
    // Try HEAD request first
    const headRes = await axios.head(url, { timeout: 10000 });
    let size = headRes.headers["content-length"];
    if (size) return Number(size);

    // If no content-length in HEAD, try GET with Range header
    const rangeRes = await axios.get(url, {
      headers: { Range: "bytes=0-0" },
      timeout: 10000,
    });
    const contentRange = rangeRes.headers["content-range"];
    if (contentRange) {
      // content-range format: bytes 0-0/12345678
      const totalSize = contentRange.split("/")[1];
      return Number(totalSize);
    }

    // Size unknown
    return 0;
  } catch (err) {
    // On error, return 0 (unknown)
    return 0;
  }
}

// Fetch stream with timeout and size fallback
async function getVideoStream(url) {
  try {
    const res = await axios.get(url, {
      responseType: "stream",
      timeout: 60000,
      headers: {
        Connection: "keep-alive",
        "User-Agent": "Mozilla/5.0",
      },
    });

    let size = Number(res.headers["content-length"]) || 0;
    let mime = res.headers["content-type"] || "video/mp4";
    let host = new URL(url).hostname;

    // If size still unknown, try getSizeFromUrl helper
    if (!size) {
      size = await getSizeFromUrl(url);
    }

    return { stream: res.data, size, mime, host };
  } catch (err) {
    throw new Error("🔌 Failed to open stream");
  }
}

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

async function sendDocument(robin, from, mek, stream, title, mime, sizeMB, host) {
  const caption = `✅ *Document sent by SENAL MD* 🎥

🎞️ *Title:* ${title}
📦 *Size:* ${sizeMB || "Unknown"} MB
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
      await reply("🔎 Searching for your video...");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Video not found. Try again.*");

      // Get size safely
      let sizeBytes = 0;
      try {
        const result = await ytmp4(video.url, "360");
        if (result?.download?.url) {
          sizeBytes = await getSizeFromUrl(result.download.url);
        }
      } catch {}

      const sizeMB = sizeBytes ? (sizeBytes / 1024 / 1024).toFixed(2) : "Unknown";

      sessions[from] = {
        video,
        step: "choose_format",
        sizeMB,
      };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}
📦 *Size:* ${sizeMB} MB

📁 *Choose file type:*
🔹 *vid1* - Send as Video
🔹 *vid2* - Send as Document

✍️ _Reply with *vid1* or *vid2*_
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
      reply("❌ *Error while searching video. Try again later.*");
    }
  }
);

// 📽️ vid1: send as inline video
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
      const result = await ytmp4(session.video.url, "360");
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      await reply("📡 Opening stream...");
      const { stream, size, mime, host } = await getVideoStream(result.download.url);
      const sizeMB = (size / 1024 / 1024).toFixed(2);

      if (size > MAX_INLINE_SIZE) {
        await reply(`⚠️ *File is ${sizeMB} MB* — switching to document mode.`);
        await sendDocument(robin, from, mek, stream, session.video.title, mime, sizeMB, host);
      } else {
        await reply("📤 Uploading video...");
        await sendVideo(robin, from, mek, stream, session.video.title, mime);
      }

      reply("✅ *Video sent successfully!*");
    } catch (err) {
      console.error("vid1 error:", err);
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
      const result = await ytmp4(session.video.url, "360");
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      await reply("📡 Opening stream...");
      const { stream, size, mime, host } = await getVideoStream(result.download.url);
      const sizeMB = size ? (size / 1024 / 1024).toFixed(2) : "Unknown";

      await reply(`📁 Preparing to send...

🎞️ *Title:* ${session.video.title}
📦 *Size:* ${sizeMB} MB
📄 *Type:* ${mime}
🌐 *Host:* ${host}
`);

      await sendDocument(robin, from, mek, stream, session.video.title, mime, sizeMB, host);
      reply("✅ *Document sent successfully!*");
    } catch (err) {
      console.error("vid2 error:", err);
      reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
