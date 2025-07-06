const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
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

// .video command with normal buttons
cmd(
  {
    pattern: "video",
    desc: "🎬 Download YouTube Video (with button quality)",
    category: "download",
    react: "🎥",
  },
  async (sock, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 කරුණාකර YouTube වීඩියෝ නමක් හෝ ලින්ක් එකක් ලබාදෙන්න.");

      await reply("🔎 Searching...");

      const result = await yts(q);
      const video = result.videos[0];
      if (!video) return reply("❌ Video not found.");

      sessions[from] = {
        video,
        step: "choose_quality",
      };

      const text = `
🎬 *SENAL MD Video Downloader*

🎞️ *Title:* ${video.title}
⏱️ Duration: ${video.timestamp}
👁️ Views: ${video.views.toLocaleString()}
📤 Uploaded: ${video.ago}
🔗 URL: ${video.url}

📺 *Select video quality below:*
      `.trim();

      const buttons = [
        { buttonId: 'video_sd', buttonText: { displayText: '📥 SD (360p)' }, type: 1 },
        { buttonId: 'video_hd', buttonText: { displayText: '📺 HD (720p)' }, type: 1 },
      ];

      const buttonMsg = {
        text,
        footer: 'Powered by SENAL MD ❤️',
        buttons,
        headerType: 1,
      };

      await sock.sendMessage(from, buttonMsg, { quoted: mek });
    } catch (err) {
      console.error("YT Video Search Error:", err);
      await reply("❌ Error while preparing video buttons.");
    }
  }
);

// Video download (button click)
["sd", "hd"].forEach((quality) => {
  cmd(
    {
      pattern: `video_${quality}`,
    },
    async (sock, mek, m, { from, reply }) => {
      const session = sessions[from];
      if (!session || session.step !== "choose_quality") {
        return reply("❌ No active video session. Use `.video <name>` first.");
      }

      const video = session.video;
      const resolution = quality === "hd" ? "720" : "360";

      try {
        await reply(`📥 Downloading *${resolution}p*...`);

        const res = await ytmp4(video.url, resolution);
        if (!res?.download?.url) return reply("❌ Couldn't get download link.");

        const buffer = await downloadFile(res.download.url);
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        if (buffer.length > MAX_VIDEO_SIZE) {
          await reply(`⚠️ Video is ${sizeMB} MB. Sending as document...`);
          await sendDocument(sock, from, mek, buffer, video.title);
        } else {
          await sendVideo(sock, from, mek, buffer, video.title);
        }

        await reply("✅ Video sent!");
      } catch (err) {
        console.error("Download/send error:", err);
        await reply("❌ Error sending video.");
      }

      delete sessions[from];
    }
  );
});
