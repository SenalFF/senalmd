const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@vreden/youtube_scraper");

const tempStore = {}; // Temporary store for user video selections

cmd(
  {
    pattern: "pathan",
    react: "🎬",
    desc: "Download YouTube video (choose quality)",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { q, from, reply }) => {
    try {
      if (!q) return reply("🎥 *Enter a video name or link to download*\n\n_Example:_ `.pathan shape of you`");

      const search = await yts(q);
      const data = search.videos[0];
      if (!data) return reply("❌ No results found.");

      if (data.seconds > 1800) return reply("⏱️ *Video is longer than 30 minutes*");

      // Store URL for later
      tempStore[from] = {
        url: data.url,
        title: data.title,
        thumb: data.thumbnail,
      };

      // Ask for quality selection
      await robin.sendMessage(
        from,
        {
          text: `🎬 *Select video quality for:* ${data.title}`,
          footer: "🔽 Choose the quality below",
          title: "SENAL MD Video Downloader",
          buttonText: "🎞 Select Quality",
          sections: [
            {
              title: "Available Qualities",
              rows: [
                { title: "144p", rowId: `.getvideo 144` },
                { title: "240p", rowId: `.getvideo 240` },
                { title: "360p", rowId: `.getvideo 360` },
                { title: "480p", rowId: `.getvideo 480` },
                { title: "720p", rowId: `.getvideo 720` },
                { title: "1080p", rowId: `.getvideo 1080` },
              ],
            },
          ],
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error(e);
      reply("❌ Error: " + e.message);
    }
  }
);

// This handles .getvideo 360, etc.
cmd(
  {
    pattern: "getvideo",
    desc: "Handle video quality selection",
    fromMe: false,
  },
  async (robin, mek, m, { q, from, reply }) => {
    try {
      const quality = q || "360";
      const info = tempStore[from];

      if (!info) return reply("❌ No video session found. Try using `.pathan` again.");

      const video = await ytmp4(info.url, quality);

      const caption = `
🎬 *Title:* ${info.title}
📽 *Quality:* ${quality}p

ᴠɪᴅᴇᴏ ʙʏ ꜱᴇɴᴀʟ ᴍᴅ
`;

      // Send video
      await robin.sendMessage(
        from,
        {
          video: { url: video.download.url },
          mimetype: "video/mp4",
          caption,
        },
        { quoted: mek }
      );

      // Send as document
      await robin.sendMessage(
        from,
        {
          document: { url: video.download.url },
          mimetype: "video/mp4",
          fileName: `${info.title} (${quality}p).mp4`,
          caption: "📁 *Video as Document* | Made by SENAL MD",
        },
        { quoted: mek }
      );

      delete tempStore[from]; // Clear stored session
    } catch (e) {
      console.error(e);
      reply("❌ Error fetching video. Try again.");
    }
  }
);
