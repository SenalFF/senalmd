const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16MB WhatsApp normal video limit
const sessions = {};

const QUALITY_MAP = {
  A: "144",
  B: "240",
  C: "360",
  D: "480",
  E: "720",
  F: "1080",
};

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
      caption: title,
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
    pattern: "playvideo",
    desc: "🎥 YouTube Video Downloader with format & quality choice",
    category: "download",
    react: "🎥",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

      await reply("🔎 Searching for your video... 🎬");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Sorry, no video found. Try another keyword!*");

      // Save video meta in session, await format choice
      sessions[from] = {
        video,
        step: "choose_format",
      };

      const info = `
🎥 *SENAL MD Video Downloader*

🎬 *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

📁 *Select the format you want to receive:*
1️⃣ Normal Video
2️⃣ Document (File)

✍️ _Please reply with 1 or 2_
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
      console.error("PlayVideo Command Error:", e);
      return reply(`❌ *Error:* ${e.message}`);
    }
  }
);

cmd(
  {
    pattern: "1",
    on: "text",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    console.log("[Format Selection] session:", session);
    if (!session || session.step !== "choose_format") return;

    session.format = "video";
    session.step = "choose_quality";

    await reply(`
📺 *Select video quality:*
A. 144p
B. 240p
C. 360p
D. 480p
E. 720p
F. 1080p

✍️ _Please reply with A-F_
`);
  }
);

cmd(
  {
    pattern: "2",
    on: "text",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    console.log("[Format Selection] session:", session);
    if (!session || session.step !== "choose_format") return;

    session.format = "document";
    session.step = "choose_quality";

    await reply(`
📺 *Select video quality:*
A. 144p
B. 240p
C. 360p
D. 480p
E. 720p
F. 1080p

✍️ _Please reply with A-F_
`);
  }
);

cmd(
  {
    pattern: "^[A-Fa-f]$",
    on: "text",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, text, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_quality") return;

    const choice = text.toUpperCase();
    const quality = QUALITY_MAP[choice];
    if (!quality) return reply("❌ *Invalid choice, please reply with A-F.*");

    await reply(`⬇️ Fetching video at *${quality}p* quality... ⏳`);

    try {
      // Get video download link & info from kelvdra scraper
      const result = await ytmp4(session.video.url, quality);
      if (!result?.download?.url) return reply("⚠️ *Could not fetch the download link. Try again later.*");

      const buffer = await downloadFile(result.download.url);
      const filesize = buffer.length;
      const filesizeMB = (filesize / (1024 * 1024)).toFixed(2);

      session.buffer = buffer;
      session.filesize = filesize;

      // WhatsApp size limit check (normal video limit)
      if (session.format === "video" && filesize > MAX_VIDEO_SIZE) {
        await reply(
          `⚠️ *File size ${filesizeMB} MB exceeds WhatsApp normal video limit (16MB). Sending as document instead.*`
        );
        session.format = "document"; // fallback
      }

      if (session.format === "video") {
        await reply("⏳ Uploading video...");
        await sendVideo(robin, from, mek, buffer, session.video.title);
        await reply("✅ *Video sent successfully!* 🎥");
      } else {
        await reply("⏳ Uploading video as document...");
        await sendDocument(robin, from, mek, buffer, session.video.title);
        await reply("✅ *Document sent successfully!* 📄");
      }
    } catch (e) {
      console.error("Video send error:", e);
      await reply("❌ *Failed to send video/document. Please try again later.*");
    }

    delete sessions[from];
  }
);
