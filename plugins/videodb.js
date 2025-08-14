const { cmd } = require("../command");
const yts = require("yt-search");
const svdl = require("@blackamda/song_video_dl");

const sessions = {};

cmd(
  {
    pattern: "vid",
    desc: "📥 YouTube Video Downloader",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    if (!q) return reply("🔍 *Please provide a YouTube video name or link*");

    try {
      await reply("🔎 Searching for your video...");
      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Video not found. Try again.*");

      sessions[from] = { video, step: "choose_format" };

      const info = `
🎬 *Video Downloader*

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

// Send as inline video
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
      await reply("⏬ Fetching download link...");
      const result = await svdl.download(session.video.url, {
        type: "video",
        quality: 360,
        server: "en68",
      });

      if (!result?.link) return reply("❌ Couldn't get video download URL.");

      await reply("📤 Uploading video...");
      await robin.sendMessage(
        from,
        {
          video: { url: result.link },
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

// Send as document
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
      await reply("⏬ Fetching download link...");
      const result = await svdl.download(session.video.url, {
        type: "video",
        quality: 360,
        server: "en68",
      });

      if (!result?.link) return reply("❌ Couldn't get video download URL.");

      await reply("📤 Uploading document...");
      await robin.sendMessage(
        from,
        {
          document: { url: result.link },
          mimetype: "video/mp4",
          fileName: `${session.video.title.slice(0, 30)}.mp4`,
          caption: "✅ *Document sent* 🎥",
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
