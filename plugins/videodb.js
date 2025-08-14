const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");

const sessions = {};

cmd(
  {
    pattern: "ytv",
    desc: "📥 YouTube Video Downloader",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    if (!q) return reply("🔍 *Please provide a video name or YouTube link*");

    try {
      await reply("🔎 *Searching for your video...*");
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
🔹 *vid1* - Send as Video
🔹 *vid2* - Send as Document

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

// 📽️ Send inline video
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
      await reply("⏬ *Fetching video download link...*");
      const result = await ytmp4(session.video.url, "360");
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      await reply("📤 *Sending video to WhatsApp...*");
      await robin.sendMessage(
        from,
        {
          video: { url: result.download.url }, // direct link
          mimetype: "video/mp4",
          fileName: `${session.video.title.slice(0, 30)}.mp4`,
          caption: `🎬 *${session.video.title}*`,
        },
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

// 📁 Send as document
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
      await reply("⏬ *Fetching video download link...*");
      const result = await ytmp4(session.video.url, "360");
      if (!result?.download?.url) return reply("❌ Couldn't get video download URL.");

      await reply("📤 *Sending document to WhatsApp...*");
      await robin.sendMessage(
        from,
        {
          document: { url: result.download.url }, // direct link
          mimetype: "video/mp4",
          fileName: `${session.video.title.slice(0, 30)}.mp4`,
          caption: "✅ *Document sent by SENAL MD* 🎥",
        },
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
