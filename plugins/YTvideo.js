const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const sessions = {};

// Download video
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

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

// Step 1: Search video and select quality
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

      sessions[from] = { video, step: "choose_quality" };

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

📁 *Select quality:*
`;

      const buttons = [
        { buttonId: "q360", buttonText: { displayText: "360p" }, type: 1 },
        { buttonId: "q480", buttonText: { displayText: "480p" }, type: 1 },
        { buttonId: "q720", buttonText: { displayText: "720p" }, type: 1 },
        { buttonId: "q1080", buttonText: { displayText: "1080p" }, type: 1 },
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
      reply("❌ *Error while searching video.*");
    }
  }
);

// Step 2: Select file type (after quality)
const qualities = ["360", "480", "720", "1080"];
qualities.forEach((q) => {
  cmd(
    {
      pattern: `q${q}`,
      desc: `Select ${q}p quality`,
      dontAddCommandList: true,
    },
    async (conn, mek, m, { reply }) => {
      const from = mek.key.remoteJid;
      const session = sessions[from];
      if (!session || session.step !== "choose_quality") return;

      session.quality = q;
      session.step = "choose_format";

      const buttons = [
        { buttonId: "video1", buttonText: { displayText: "📹 Inline Video" }, type: 1 },
        { buttonId: "video2", buttonText: { displayText: "📁 Document" }, type: 1 },
      ];

      await conn.sendMessage(
        from,
        {
          text: `🎬 Selected *${q}p* quality\n📁 Now select file type:`,
          buttons,
          headerType: 1,
        },
        { quoted: mek }
      );
    }
  );
});

// Step 3: Send inline video
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
      const result = await ytmp4(session.video.url, session.quality);
      if (!result?.url) return reply("❌ Couldn't get video URL.");

      const buffer = await downloadFile(result.url);
      await reply("📤 Uploading inline video...");
      await sendVideo(conn, from, mek, buffer, session.video.title);
      await reply("✅ *Video sent successfully!*");

      delete sessions[from];
    } catch (err) {
      console.error("Video1 error:", err);
      reply("❌ *Failed to send video.*");
    }
  }
);

// Step 3: Send as document
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
      const result = await ytmp4(session.video.url, session.quality);
      if (!result?.url) return reply("❌ Couldn't get video URL.");

      const buffer = await downloadFile(result.url);
      await reply("📤 Uploading document...");
      await sendDocument(conn, from, mek, buffer, session.video.title);
      await reply("✅ *Document sent successfully!*");

      delete sessions[from];
    } catch (err) {
      console.error("Video2 error:", err);
      reply("❌ *Failed to send document.*");
    }
  }
);
