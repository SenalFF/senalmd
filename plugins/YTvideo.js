const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const WHATSAPP_MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16 MB max for normal video
const sessions = {};

const QUALITY = "360"; // default quality 360p

async function sendProgressBar(robin, from, baseText = "🔄 Processing", steps = 5, delay = 600) {
  const frames = [
    "[          ] 0%",
    "[##        ] 20%",
    "[####      ] 40%",
    "[######    ] 60%",
    "[########  ] 80%",
    "[##########] 100%",
  ];

  for (let i = 0; i < steps && i < frames.length; i++) {
    await robin.sendMessage(from, { text: `${baseText} ${frames[i]}` });
    await new Promise((r) => setTimeout(r, delay));
  }
}

async function getFileSize(url) {
  try {
    const head = await axios.head(url);
    const length = head.headers["content-length"];
    return length ? parseInt(length) : null;
  } catch {
    return null;
  }
}

cmd(
  {
    pattern: "playvideo",
    desc: "🎥 YouTube Video Downloader (360p) with animated progress & file size",
    category: "download",
    react: "🎥",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 *කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න*");

      // Animated searching progress
      await sendProgressBar(robin, from, "🔎 Searching video");

      const searchResult = await yts(q);
      const video = searchResult.videos[0];
      if (!video) return reply("❌ *Sorry, no video found. Try another keyword!*");

      // Animated fetching info progress
      await sendProgressBar(robin, from, "⬇️ Fetching video info");

      const result = await ytmp4(video.url, QUALITY);
      if (!result?.download?.url)
        return reply("⚠️ *Could not fetch the 360p video download link. Try again later.*");

      const videoUrl = result.download.url;
      const fileSize = await getFileSize(videoUrl);
      const fileSizeMB = fileSize ? (fileSize / (1024 * 1024)).toFixed(2) : "Unknown";

      const info = `
🎥 *SENAL MD Video Downloader (360p)*

🎬 *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
📦 *File Size:* ${fileSizeMB} MB
🔗 *URL:* ${video.url}

⚠️ *WhatsApp max normal video size:* 16 MB

📁 *How do you want to receive the video?*
1️⃣ Normal Video File (if size ≤ 16 MB)
2️⃣ Document File (for bigger files or preferred)

✍️ _Please reply with 1 or 2_
`;

      sessions[from] = {
        video,
        videoUrl,
        fileSize,
        step: "choose_send_type",
      };

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
    pattern: "^[12]{1}$",
    on: "text",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, text, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_send_type") return;

    const choice = text.trim();

    // Animated uploading progress
    await sendProgressBar(robin, from, "⏳ Uploading video");

    if (choice === "1") {
      // Normal video send if size ok
      if (session.fileSize && session.fileSize > WHATSAPP_MAX_VIDEO_SIZE) {
        await reply(
          "⚠️ *File too big for normal video sending! Sending as document instead.*"
        );
      } else {
        try {
          await robin.sendMessage(
            from,
            {
              video: { url: session.videoUrl },
              mimetype: "video/mp4",
              fileName: `${session.video.title.slice(0, 30)}.mp4`,
              caption: "✅ *Video sent by SENAL MD* ❤️",
            },
            { quoted: mek }
          );
          await reply("✅ *Video sent successfully!* 🎥");
          delete sessions[from];
          return;
        } catch (e) {
          console.error("Video send error:", e);
          await reply("❌ *Failed to send video. Sending as document instead...*");
        }
      }
    }

    // Send as document fallback or if user chose 2
    try {
      await robin.sendMessage(
        from,
        {
          document: { url: session.videoUrl },
          mimetype: "video/mp4",
          fileName: `${session.video.title.slice(0, 30)}.mp4`,
          caption: "✅ *Document sent by SENAL MD* ❤️",
        },
        { quoted: mek }
      );
      await reply("✅ *Document sent successfully!* 📄");
    } catch (e) {
      console.error("Document send error:", e);
      await reply("❌ *Failed to send document. Please try again later.*");
    }

    delete sessions[from];
  }
);
