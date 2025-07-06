const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB limit
const sessions = {};

async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

async function sendVideo(sock, from, mek, buffer, title) {
  await sock.sendMessage(
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

async function sendDocument(sock, from, mek, buffer, title) {
  await sock.sendMessage(
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

// Main .video command
cmd(
  {
    pattern: "video",
    desc: "🎬 Download YouTube Video with Quality Buttons",
    category: "download",
    react: "🎥",
  },
  async (sock, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 කරුණාකර YouTube වීඩියෝ නමක් හෝ ලින්ක් එකක් ලබාදෙන්න.");

      await reply("🔎 Searching on YouTube...");

      const result = await yts(q);
      const video = result.videos[0];
      if (!video) return reply("❌ *Video not found. Try a different keyword.*");

      // Download thumbnail buffer
      const thumbRes = await axios.get(video.thumbnail, { responseType: "arraybuffer" });
      const imageBuffer = Buffer.from(thumbRes.data);

      // Save session
      sessions[from] = {
        video,
        step: "choose_quality",
      };

      // Prepare button message
      const buttonMsg = {
        templateMessage: {
          hydratedTemplate: {
            hydratedContentText: `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

📺 *Select video quality below:*
            `.trim(),
            hydratedFooterText: "Powered by SENAL MD ❤️",
            jpegThumbnail: imageBuffer, // ✅ Correct field
            hydratedButtons: [
              {
                quickReplyButton: {
                  displayText: "📥 SD (360p)",
                  id: "video_sd",
                },
              },
              {
                quickReplyButton: {
                  displayText: "📺 HD (720p)",
                  id: "video_hd",
                },
              },
            ],
          },
        },
      };

      await sock.sendMessage(from, buttonMsg, { quoted: mek });
    } catch (err) {
      console.error("YT Video Search Error:", err);
      await reply("❌ *Error while searching or preparing the video.*");
    }
  }
);

// SD / HD reply handlers
["sd", "hd"].forEach((quality) => {
  cmd(
    {
      pattern: `video_${quality}`,
    },
    async (sock, mek, m, { from, reply }) => {
      const session = sessions[from];
      if (!session || session.step !== "choose_quality") {
        return reply("❌ *No active video session. Use `.video <name>` first.*");
      }

      const video = session.video;
      const resolution = quality === "hd" ? "720" : "360";

      try {
        await reply(`📥 Downloading *${resolution}p*...`);

        const res = await ytmp4(video.url, resolution);
        if (!res?.download?.url) return reply("❌ *Could not fetch download link.*");

        const buffer = await downloadFile(res.download.url);
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        if (buffer.length > MAX_VIDEO_SIZE) {
          await reply(`⚠️ *Video is ${sizeMB} MB. Sending as document...*`);
          await sendDocument(sock, from, mek, buffer, video.title);
        } else {
          await sendVideo(sock, from, mek, buffer, video.title);
        }

        await reply("✅ *Video sent successfully!* 🎉");
      } catch (err) {
        console.error("YT Video Download Error:", err);
        await reply("❌ *Failed to download or send the video.*");
      }

      delete sessions[from];
    }
  );
});
