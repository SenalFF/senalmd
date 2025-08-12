const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_INLINE_VIDEO_SIZE = 64 * 1024 * 1024; // 64MB

cmd(
  {
    pattern: "vid",
    desc: "📥 YouTube Video Downloader",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    try {
      if (!q) return reply("❌ *Please enter a YouTube link or search query.*");

      const from = mek.key.remoteJid;

      // Search YouTube
      const search = await yts(q);
      const video = search.videos[0];
      if (!video) return reply("❌ *No results found.*");

      const { url, title, timestamp, ago, views } = video;

      // Get video info
      const info = await ytmp4(url);
      if (!info || !info.videoUrl) return reply("❌ *Failed to fetch video details.*");

      const fileSize = parseInt(info.size.split("MB")[0].trim()) * 1024 * 1024;

      const caption = `📽️ *Title:* ${title}\n🕒 *Duration:* ${timestamp}\n👀 *Views:* ${views}\n⏳ *Uploaded:* ${ago}\n🔗 *Link:* ${url}`;

      if (fileSize > MAX_DOCUMENT_SIZE) {
        return reply("❌ *Video too large to send.*");
      }

      // Create a temp file path
      const tempPath = path.join(__dirname, `${Date.now()}.mp4`);

      // Download video in chunks (streaming)
      const writer = fs.createWriteStream(tempPath);
      const response = await axios({
        method: "get",
        url: info.videoUrl,
        responseType: "stream",
        timeout: 60000,
      });

      await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      // Send file
      await robin.sendMessage(
        from,
        {
          video: fs.readFileSync(tempPath),
          caption,
          mimetype: "video/mp4",
          fileName: `${title}.mp4`,
          asDocument: fileSize > MAX_INLINE_VIDEO_SIZE,
        }
      );

      // Delete temp file after sending
      fs.unlinkSync(tempPath);

    } catch (err) {
      console.error("vid error:", err);
      return reply("⚠️ *An error occurred while executing the command.*\n\n_Use cmd: `vid <title or link>`_");
    }
  }
);
