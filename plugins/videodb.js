const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_INLINE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const sessions = {};

// 🔎 Get file size from HEAD or Range
async function getSizeFromUrl(url) {
  try {
    const head = await axios.head(url, { timeout: 10000 });
    const size = head.headers["content-length"];
    if (size) return Number(size);

    const range = await axios.get(url, {
      headers: { Range: "bytes=0-0" },
      timeout: 10000,
    });
    const contentRange = range.headers["content-range"];
    if (contentRange) return Number(contentRange.split("/")[1]);
  } catch (err) {
    console.warn("getSizeFromUrl error:", err.message || err);
  }
  return 0;
}

// 📥 Open stream with error handling
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

    const size =
      Number(res.headers["content-length"]) || (await getSizeFromUrl(url));
    const mime = res.headers["content-type"] || "video/mp4";
    const host = new URL(url).hostname;

    res.data.on("error", (err) => {
      console.error("Stream error:", err);
      res.data.destroy();
    });

    return { stream: res.data, size, mime, host };
  } catch (err) {
    console.error("getVideoStream error:", err);
    throw new Error("🔌 Failed to open stream");
  }
}

// 🎥 Send inline video
async function sendVideo(robin, from, mek, stream, title, mime) {
  return robin.sendMessage(
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

// 📄 Send as document
async function sendDocument(robin, from, mek, stream, title, mime, sizeMB, host) {
  const caption = `✅ *Document sent by SENAL MD* 🎥

🎞️ *Title:* ${title}
📦 *Size:* ${sizeMB || "Unknown"} MB
📄 *Type:* ${mime}
🌐 *Source:* ${host}`;

  return robin.sendMessage(
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

// ▶️ .vid Command
cmd(
  {
    pattern: "vid",
    desc: "📥 YouTube Video Downloader",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    if (!q) return reply("🔍 Please provide a video name or YouTube link.");

    try {
      await reply("🔎 Searching for your video...");
      const search = await yts(q);
      const video = search.videos[0];
      if (!video) return reply("❌ *Video not found. Try a different keyword.*");

      let sizeMB = "Unknown";
      try {
        const result = await ytmp4(video.url, "360");
        if (result?.download?.url) {
          const bytes = await getSizeFromUrl(result.download.url);
          if (bytes > 0) sizeMB = (bytes / 1024 / 1024).toFixed(2);
        }
      } catch {}

      sessions[from] = {
        video,
        step: "choose_format",
        sizeMB,
      };

      const info = `
🎬 SENAL MD Video Downloader

🎞️ Title: ${video.title}
⏱️ Duration: ${video.timestamp}
👁️ Views: ${video.views.toLocaleString()}
📤 Uploaded: ${video.ago}
🔗 URL: ${video.url}
📦 Size: ${sizeMB} MB

📁 Choose file type:
🔹 vid1 - Send as Video
🔹 vid2 - Send as Document

✍️ Reply with vid1 or vid2
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
      console.error("vid command error:", err);
      reply("❌ *Error occurred while processing. Please try again.*");
    }
  }
);

// 📽️ vid1 command
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
      if (!result?.download?.url) return reply("❌ Couldn’t get video download URL.");

      await reply("📡 Opening stream...");
      const { stream, size, mime, host } = await getVideoStream(result.download.url);
      const sizeMB = size ? (size / 1024 / 1024).toFixed(2) : "Unknown";

      if (size > MAX_INLINE_SIZE) {
        await reply(`⚠️ *Video is ${sizeMB} MB* — switching to document...`);
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

// 📁 vid2 command
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
      if (!result?.download?.url) return reply("❌ Couldn’t get video download URL.");

      await reply("📡 Opening stream...");
      const { stream, size, mime, host } = await getVideoStream(result.download.url);
      const sizeMB = size ? (size / 1024 / 1024).toFixed(2) : "Unknown";

      if (size > MAX_DOCUMENT_SIZE) {
        return reply("🚫 *Video exceeds WhatsApp 2GB document limit.*");
      }

      await reply(`📁 Preparing to send...

🎞️ *Title:* ${session.video.title}
📦 *Size:* ${sizeMB} MB
📄 *Type:* ${mime}
🌐 *Host:* ${host}`);

      await sendDocument(robin, from, mek, stream, session.video.title, mime, sizeMB, host);
      reply("✅ *Document sent successfully!*");
    } catch (err) {
      console.error("vid2 error:", err);
      reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
