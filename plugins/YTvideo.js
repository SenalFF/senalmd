const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB WhatsApp inline video limit
const sessions = {};

// Download file to buffer from direct link
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// Send as inline video
async function sendVideo(robin, from, mek, buffer, title) {
  await robin.sendMessage(
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

// Send as document
async function sendDocument(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "✅ *Video sent by SENAL MD* ❤️",
    },
    { quoted: mek }
  );
}

cmd(
  {
    pattern: "video",
    desc: "📹 YouTube Video Downloader with format choice",
    category: "download",
    react: "🎥",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

      await reply("🔎 Searching for your video... 📹");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Video not found. Try another keyword!*");

      await reply("⬇️ Fetching video info... ⏳");

      const result = await ytmp4(video.url, "360"); // Using 360p
      if (!result?.url) return reply("⚠️ *Could not fetch video link. Try again later.*");

      const buffer = await downloadFile(result.url);
      const filesize = buffer.length;
      const filesizeMB = (filesize / (1024 * 1024)).toFixed(2);

      sessions[from] = {
        video,
        buffer,
        filesize,
        step: "choose_format",
      };

      const info = `
📹 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
📦 *File Size:* ${filesizeMB} MB
🔗 *URL:* ${video.url}

📁 *Select the format you want to receive:*
1️⃣ Inline Video
2️⃣ Document (File)

✍️ _Please reply with 1 or 2_

⚠️ _Inline videos must be under 50MB on WhatsApp._
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
      console.error("Video Command Error:", e);
      return reply(`❌ *Error:* ${e.message}`);
    }
  }
);

// 1️⃣ Reply handler: inline video
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";

    try {
      if (session.filesize > MAX_VIDEO_SIZE) {
        await reply(
          `⚠️ *Video too large (${(session.filesize / (1024 * 1024)).toFixed(2)} MB) for inline send.*\nSending as document...`
        );
        await sendDocument(robin, from, mek, session.buffer, session.video.title);
        await reply("✅ *Video sent as document!* 📄");
      } else {
        await reply("⏳ Uploading inline video...");
        await sendVideo(robin, from, mek, session.buffer, session.video.title);
        await reply("✅ *Video sent successfully!* 🎥");
      }
    } catch (e) {
      console.error("Video send error:", e);
      await reply("❌ *Failed to send video. Try again later.*");
    }

    delete sessions[from];
  }
);

// 2️⃣ Reply handler: document
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";

    try {
      await reply("⏳ Uploading video as document...");
      await sendDocument(robin, from, mek, session.buffer, session.video.title);
      await reply("✅ *Video sent as document!* 📄");
    } catch (e) {
      console.error("Document send error:", e);
      await reply("❌ *Failed to send video. Try again later.*");
    }

    delete sessions[from];
  }
);
