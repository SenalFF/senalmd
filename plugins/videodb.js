const { cmd } = require("../command");
const yts = require("yt-search");
const fg = require("@blackamda/song_video_dl"); // fallback module
const kelvdra = require("@kelvdra/scraper");
const ruhend = require("ruhend-scraper");
const bochil = require("@bochilteam/scraper");

const sessions = {};

// Normalize YouTube URL
const normalizeYouTubeURL = (url) => {
  if (url.startsWith("https://youtu.be/")) {
    const videoId = url.split("/").pop().split("?")[0];
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return url;
};

// Failover function to get downloadable URL
async function getDownloadURL(url) {
  const modules = [
    async () => fg.ytv(url),
    async () => kelvdra.ytv(url),
    async () => ruhend.ytv(url),
    async () => bochil.ytv(url),
  ];

  for (let fn of modules) {
    try {
      const res = await fn();
      if (res && (res.dl_url || res.url)) return res.dl_url || res.url;
    } catch {}
  }
  return null;
}

// ======== .video command ========
cmd(
  {
    pattern: "vid",
    desc: "📥 YouTube Video Downloader",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    if (!q) return reply("🔍 *Please provide a YouTube link or name*");

    try {
      await reply("🔎 Searching for your video...");
      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Video not found. Try again.*");

      sessions[from] = { video, step: "choose_format" };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

📁 *Choose file type:*
🔹 *video1* - Send as Video
🔹 *video2* - Send as Document

✍️ _Reply with *vid1* or *vid2*_
`;
      await robin.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption: info },
        { quoted: mek }
      );
    } catch (err) {
      console.error("YT Video Error:", err);
      return reply("❌ *Error while searching video. Try again later.*");
    }
  }
);

// ======== video1: send inline video (streaming) ========
cmd(
  { pattern: "vid1", desc: "Send YouTube video inline", dontAddCommandList: true },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;
    session.step = "sending";

    try {
      await reply("⏬ Fetching download URL...");
      const downloadUrl = await getDownloadURL(session.video.url);
      if (!downloadUrl) return reply("❌ All downloaders failed.");

      await reply("📤 Sending inline video...");
      await robin.sendMessage(
        from,
        { video: { url: downloadUrl }, mimetype: "video/mp4", fileName: `${session.video.title}.mp4`, caption: `🎬 *${session.video.title}*` },
        { quoted: mek }
      );

      await reply("✅ *Video sent successfully!*");

    } catch (err) {
      console.error("Video1 send error:", err);
      await reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// ======== video2: send as document (streaming) ========
cmd(
  { pattern: "vid2", desc: "Send YouTube video as document", dontAddCommandList: true },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;
    session.step = "sending";

    try {
      await reply("⏬ Fetching download URL...");
      const downloadUrl = await getDownloadURL(session.video.url);
      if (!downloadUrl) return reply("❌ All downloaders failed.");

      await reply("📤 Sending document...");
      await robin.sendMessage(
        from,
        { document: { url: downloadUrl }, mimetype: "video/mp4", fileName: `${session.video.title}.mp4`, caption: "✅ *Document sent by SENAL MD* 🎥" },
        { quoted: mek }
      );

      await reply("✅ *Document sent successfully!*");

    } catch (err) {
      console.error("Video2 send error:", err);
      await reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
