const { cmd } = require("../command");
const yts = require("yt-search");
const { yt720, yt480, yt360 } = require("y2mate-dl");

const sessions = {};

// 📥 Search video
cmd(
  {
    pattern: "vid",
    desc: "📥 YouTube Video Downloader",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    if (!q) return reply("🔍 *Please provide a video name or YouTube link*");

    try {
      await reply("🔎 Searching for your video...");
      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Video not found. Try again.*");

      sessions[from] = { video, step: "choose_quality" };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

📁 *Choose Quality:*
🔹 *q360* - 360p
🔹 *q480* - 480p
🔹 *q720* - 720p

✍️ _Reply with one of the above commands_
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

// 📌 Helper to set quality
async function setQuality(from, quality) {
  if (!sessions[from] || sessions[from].step !== "choose_quality") return null;
  sessions[from].quality = quality;
  sessions[from].step = "choose_format";
  return sessions[from];
}

// 📥 Choose Quality
["q360", "q480", "q720"].forEach((cmdName) => {
  cmd(
    {
      pattern: cmdName,
      dontAddCommandList: true,
    },
    async (robin, mek, m, { reply }) => {
      const from = mek.key.remoteJid;
      const session = await setQuality(from, cmdName);
      if (!session) return;

      await reply(
        `✅ Quality set to ${cmdName.replace("q", "")}p.\nNow choose format:\n\n🔹 *vid1* - Send as Video\n🔹 *vid2* - Send as Document`
      );
    }
  );
});

// 📽️ Send inline video
cmd(
  {
    pattern: "vid1",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";
    try {
      await reply("⏬ Fetching video download link...");

      let result;
      if (session.quality === "q720") result = await yt720(session.video.url);
      else if (session.quality === "q480") result = await yt480(session.video.url);
      else result = await yt360(session.video.url);

      if (!result?.url) return reply("❌ Couldn't get video download URL.");

      const sizeMB = parseFloat(result.size.replace(" MB", ""));
      if (sizeMB > 2000) {
        return reply(`⚠️ This file is ${result.size}, exceeds WhatsApp 2GB limit.`);
      }

      await reply("📤 Uploading inline video...");
      await robin.sendMessage(
        from,
        {
          video: { url: result.url },
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
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";
    try {
      await reply("⏬ Fetching video download link...");

      let result;
      if (session.quality === "q720") result = await yt720(session.video.url);
      else if (session.quality === "q480") result = await yt480(session.video.url);
      else result = await yt360(session.video.url);

      if (!result?.url) return reply("❌ Couldn't get video download URL.");

      const sizeMB = parseFloat(result.size.replace(" MB", ""));
      if (sizeMB > 2000) {
        return reply(`⚠️ This file is ${result.size}, exceeds WhatsApp 2GB limit.`);
      }

      await reply("📤 Uploading document...");
      await robin.sendMessage(
        from,
        {
          document: { url: result.url },
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
