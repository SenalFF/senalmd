const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_INLINE_VIDEO_SIZE = 64 * 1024 * 1024; // 64MB

cmd({
  pattern: "vid",
  desc: "Download YouTube video by search or URL",
  category: "downloader",
  use: "<YouTube link or title>",
  filename: __filename,
}, async (message, match) => {
  try {
    if (!match) return message.reply("❌ *Please enter a YouTube link or search query.*");

    const search = await yts(match);
    const video = search.videos[0];
    if (!video) return message.reply("❌ *No results found.*");

    const { url, title, timestamp, ago, views, image } = video;
    const info = await ytmp4(url);
    if (!info || !info.videoUrl) return message.reply("❌ *Failed to fetch video details.*");

    const fileSize = parseInt(info.size.split("MB")[0].trim()) * 1024 * 1024;

    const caption = `📽️ *Title:* ${title}\n🕒 *Duration:* ${timestamp}\n👀 *Views:* ${views}\n⏳ *Uploaded:* ${ago}\n🔗 *Link:* ${url}`;

    if (fileSize > MAX_DOCUMENT_SIZE) {
      return message.reply("❌ *Video too large to send.*");
    }

    const res = await axios.get(info.videoUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    await message.send(
      Buffer.from(res.data),
      {
        caption,
        mimetype: "video/mp4",
        fileName: `${title}.mp4`,
        asDocument: fileSize > MAX_INLINE_VIDEO_SIZE,
      },
      "video"
    );
  } catch (err) {
    console.error("vid error:", err);
    return message.reply("⚠️ *An error occurred while executing the command.*\n\n_Use cmd: `vid <title or link>`_");
  }
});
