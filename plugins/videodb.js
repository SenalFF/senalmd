const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");
const uploadToGofile = require("../lib/upload");

const sessions = {};
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

async function sendFromGofile(robin, from, mek, gofileUrl, title) {
  return robin.sendMessage(
    from,
    {
      document: { url: gofileUrl },
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "✅ *Streamed from Gofile.io*",
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
    if (!q) return reply("❓ Please provide YouTube video title or link.");

    try {
      reply("🔍 Searching YouTube...");
      const search = await yts(q);
      const video = search.videos[0];
      if (!video) return reply("❌ No video found.");

      sessions[from] = { video };

      const info = `
🎬 *${video.title}*
⏱️ Duration: ${video.timestamp}
👁️ Views: ${video.views.toLocaleString()}
📤 Uploaded: ${video.ago}
🔗 ${video.url}

📁 Choose:
🟢 *get1* - Stream from Gofile
🟡 *get2* - Stream as Document
`;

      await robin.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption: info,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error(e);
      reply("❌ Failed to search YouTube.");
    }
  }
);

async function handleDownloadAndSend(robin, from, mek, reply, asDocument = false) {
  const session = sessions[from];
  if (!session) return reply("❌ Please use *.vid* command first.");

  try {
    reply("📥 Downloading YouTube stream...");
    const result = await ytmp4(session.video.url, "360");
    const bufferRes = await axios.get(result.download.url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(bufferRes.data);

    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    reply(`📦 *Size:* ${sizeMB} MB`);

    const filename = `${session.video.title.slice(0, 30)}.mp4`;
    const gofileUrl = await uploadToGofile(buffer, filename, reply);
    if (!gofileUrl) return;

    await sendFromGofile(robin, from, mek, gofileUrl, session.video.title);
    reply("✅ Done. Delivered via Gofile.");
  } catch (err) {
    console.error("Download error:", err);
    reply("❌ Failed to download or upload video.");
  }

  delete sessions[from];
}

// get1 – video
cmd(
  {
    pattern: "get1",
    desc: "Send video from YouTube (via Gofile)",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    await handleDownloadAndSend(robin, from, mek, reply, false);
  }
);

// get2 – document
cmd(
  {
    pattern: "get2",
    desc: "Send YouTube as document (via Gofile)",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    await handleDownloadAndSend(robin, from, mek, reply, true);
  }
);
