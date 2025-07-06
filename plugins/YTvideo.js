const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const sessions = {};

// Download file buffer
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// Send video
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

// Send document
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

// Main .video command
cmd(
  {
    pattern: "video",
    desc: "🎬 Download YouTube Video with Quality",
    category: "download",
    react: "🎥",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 කරුණාකර YouTube වීඩියෝ නමක් හෝ ලින්ක් එකක් දාන්න.");

      await reply("🔎 Searching...");

      const result = await yts(q);
      const video = result.videos[0];
      if (!video) return reply("❌ Video not found.");

      sessions[from] = {
        video,
        step: "choose_quality",
      };

      const buttonsMessage = {
        templateMessage: {
          hydratedTemplate: {
            image: { url: video.thumbnail },
            hydratedContentText: `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ Duration: ${video.timestamp}
👁️ Views: ${video.views.toLocaleString()}
📤 Uploaded: ${video.ago}
🔗 URL: ${video.url}

📺 Select your video quality:
            `.trim(),
            hydratedFooterText: "Powered by SENAL MD",
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

      await robin.sendMessage(from, buttonsMessage, { quoted: mek });
    } catch (err) {
      console.error("Video search error:", err);
      await reply("❌ Error while processing video.");
    }
  }
);

// Button reply handler
["sd", "hd"].forEach((quality) => {
  cmd(
    {
      pattern: `video_${quality}`,
    },
    async (robin, mek, m, { from, reply }) => {
      const session = sessions[from];
      if (!session || session.step !== "choose_quality") return reply("❌ No active video session.");

      const video = session.video;
      const resolution = quality === "hd" ? "720" : "360";

      try {
        await reply(`📥 Downloading ${resolution}p...`);

        const res = await ytmp4(video.url, resolution);
        if (!res?.download?.url) return reply("❌ Failed to get download URL.");

        const buffer = await downloadFile(res.download.url);
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        if (buffer.length > MAX_VIDEO_SIZE) {
          await reply(`⚠️ File is ${sizeMB} MB. Sending as document...`);
          await sendDocument(robin, from, mek, buffer, video.title);
        } else {
          await sendVideo(robin, from, mek, buffer, video.title);
        }

        await reply("✅ Done!");
      } catch (err) {
        console.error("Download/send error:", err);
        await reply("❌ Failed to send video.");
      }

      delete sessions[from];
    }
  );
});
