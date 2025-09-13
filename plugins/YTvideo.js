const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const sessions = {};

// Download video into buffer
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// Send inline video
async function sendVideo(conn, from, mek, buffer, title) {
  await conn.sendMessage(
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

// Send document
async function sendDocument(conn, from, mek, buffer, title) {
  await conn.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "✅ *Sent as Document by SENAL MD* 🎥",
    },
    { quoted: mek }
  );
}

// ▶️ .video command
cmd(
  {
    pattern: "video",
    desc: "📥 YouTube Video Downloader",
    category: "download",
    react: "📹",
  },
  async (conn, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;

    if (!q) return reply("🔍 *Please enter a video name or YouTube link.*");

    try {
      await reply("🔎 Searching for your video...");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Video not found.*");

      // Save session
      sessions[from] = { video, step: "choose_format" };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

📁 *Choose how to receive file:*
`;

      const buttons = [
        { buttonId: "video1", buttonText: { displayText: "📹 Inline Video" }, type: 1 },
        { buttonId: "video2", buttonText: { displayText: "📁 Document" }, type: 1 },
      ];

      await conn.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption: info,
          footer: "⚡ SENAL-MD Downloader",
          buttons,
          headerType: 4,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("YT Video Error:", err);
      return reply("❌ *Error while searching video.*");
    }
  }
);

// 📽️ video1: send inline video
cmd(
  {
    pattern: "video1",
    desc: "Send YouTube video inline",
    dontAddCommandList: true,
  },
  async (conn, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    try {
      await reply("⏬ Fetching video download link...");
      const result = await ytmp4(session.video.url, "720");
      if (!result?.download?.url) return reply("❌ Couldn't get download URL.");

      const buffer = await downloadFile(result.download.url);

      await reply("📤 Uploading inline video...");
      await sendVideo(conn, from, mek, buffer, session.video.title);
      await reply("✅ *Video sent successfully!*");
    } catch (err) {
      console.error("Video1 error:", err);
      await reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// 📁 video2: send as document
cmd(
  {
    pattern: "video2",
    desc: "Send YouTube video as document",
    dontAddCommandList: true,
  },
  async (conn, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    try {
      await reply("⏬ Fetching video download link...");
      const result = await ytmp4(session.video.url, "720");
      if (!result?.download?.url) return reply("❌ Couldn't get download URL.");

      const buffer = await downloadFile(result.download.url);

      await reply("📤 Uploading document...");
      await sendDocument(conn, from, mek, buffer, session.video.title);
      await reply("✅ *Document sent successfully!*");
    } catch (err) {
      console.error("Video2 error:", err);
      await reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
