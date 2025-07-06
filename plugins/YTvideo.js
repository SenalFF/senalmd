const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB WhatsApp limit for video
const sessions = {};

async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

async function sendVideo(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      video: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "🎬 *Video sent by SENAL MD* 🎥",
    },
    { quoted: mek }
  );
}

async function sendDocument(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "✅ *Document sent by SENAL MD* ❤️",
    },
    { quoted: mek }
  );
}

cmd(
  {
    pattern: "video",
    desc: "📽️ YouTube Video Downloader with format choice",
    category: "download",
    react: "🎬",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

      await reply("🔎 Searching for your video... 📹");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Sorry, no video found. Try another keyword!*");

      await reply("⬇️ Fetching video info... ⏳");

      const result = await ytmp4(video.url, "360"); // Quality: 360p
      if (!result?.download?.url) return reply("⚠️ *Could not fetch the download link. Try again later.*");

      const buffer = await downloadFile(result.download.url);
      const filesize = buffer.length;

      sessions[from] = {
        video,
        buffer,
        filesize,
        step: "choose_video_format",
      };

      const filesizeMB = (filesize / (1024 * 1024)).toFixed(2);

      const info = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
📦 *File Size:* ${filesizeMB} MB
🔗 *URL:* ${video.url}

📁 *Select the format you want to receive:*
1️⃣ Video (Play inline)
2️⃣ Document (File format)

✍️ _Please reply with 1 or 2_

⚠️ _Note: WhatsApp limits video upload to 50 MB._
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

// Option 1: Send as video (inline)
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_video_format") return;

    session.step = "sending";

    try {
      if (session.filesize > MAX_VIDEO_SIZE) {
        await reply(
          `⚠️ *Video file is too large (${(session.filesize / (1024 * 1024)).toFixed(2)} MB).* Sending as document instead...`
        );
        await sendDocument(robin, from, mek, session.buffer, session.video.title);
        await reply("✅ *Document sent successfully!* 📄");
      } else {
        await reply("⏳ Uploading video...");
        await sendVideo(robin, from, mek, session.buffer, session.video.title);
        await reply("✅ *Video sent successfully!* 🎥");
      }
    } catch (e) {
      console.error("Video send error:", e);
      await reply("❌ *Failed to send video/document. Please try again later.*");
    }

    delete sessions[from];
  }
);

// Option 2: Send as document
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_video_format") return;

    session.step = "sending";

    try {
      await reply("⏳ Uploading video as document...");
      await sendDocument(robin, from, mek, session.buffer, session.video.title);
      await reply("✅ *Document sent successfully!* 📄");
    } catch (e) {
      console.error("Document send error:", e);
      await reply("❌ *Failed to send document. Please try again later.*");
    }

    delete sessions[from];
  }
);
