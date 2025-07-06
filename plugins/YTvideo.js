const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16 MB WhatsApp normal video limit
const QUALITY_MAP = {
  A: "144",
  B: "240",
  C: "360",
  D: "480",
  E: "720",
  F: "1080",
};
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
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.format = "normal";
    session.step = "choose_quality";

    await robin.sendMessage(
      from,
      {
        text: `📊 *Choose Quality:*\n
A 144p\nB 240p\nC 360p\nD 480p\nE 720p\nF 1080p\n
✍️ _Please reply with A, B, C, D, E or F_`,
      },
      { quoted: mek }
    );
  }
);

cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.format = "document";
    session.step = "choose_quality";

    await robin.sendMessage(
      from,
      {
        text: `📊 *Choose Quality:*\n
A 144p\nB 240p\nC 360p\nD 480p\nE 720p\nF 1080p\n
✍️ _Please reply with A, B, C, D, E or F_`,
      },
      { quoted: mek }
    );
  }
);

cmd(
  {
    pattern: "^[A-Fa-f]$",
    on: "text",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply, text }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_quality") return;

    const qualityKey = text.toUpperCase();
    const quality = QUALITY_MAP[qualityKey];

    if (!quality) return reply("❌ *Invalid quality option. Reply A to F.*");

    session.step = "sending";

    await reply(`⬇️ Fetching video at ${quality}p quality... Please wait ⏳`);

    try {
      const result = await ytmp4(session.video.url, quality);
      if (!result?.download?.url) return reply("⚠️ *Could not fetch download link. Try again later.*");

      const buffer = await downloadFile(result.download.url);
      const filesize = buffer.length;
      const filesizeMB = (filesize / (1024 * 1024)).toFixed(2);

      // WhatsApp size limit check for normal video
      if (session.format === "normal" && filesize > MAX_VIDEO_SIZE) {
        await reply(
          `⚠️ *Video size (${filesizeMB} MB) is too large for normal video sending.*\n` +
            `Sending as document instead...`
        );
        await sendDocument(robin, from, mek, buffer, session.video.title);
        await reply("✅ *Document sent successfully!* 📄");
      } else if (session.format === "normal") {
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
