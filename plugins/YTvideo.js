const { cmd } = require("../command");
const yts = require("yt-search");
const youtubedl = require("youtube-dl-exec");

// ✅ Normalize YouTube URL
function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

// ✅ Convert seconds to mm:ss
function formatDuration(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}

// ✅ Main command
cmd(
  {
    pattern: "video",
    react: "🎥",
    desc: "Download YouTube Video",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("නමක් හරි ලින්ක් එකක් හරි දෙන්න 🌚❤️");

      let videoUrl = "";
      let videoInfo = null;

      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
      } else {
        const search = await yts(q);
        if (!search.videos.length) return reply("❌ Video not found.");
        const video = search.videos[0];
        videoUrl = video.url;
        videoInfo = {
          title: video.title,
          duration: video.timestamp,
          views: video.views,
          upload: video.ago,
          thumbnail: video.thumbnail,
        };
      }

      // If link was passed directly, get video info via yt-search
      if (!videoInfo) {
        const id = normalizeYouTubeUrl(videoUrl).split("v=")[1];
        const info = await yts({ videoId: id });
        videoInfo = {
          title: info.title,
          duration: info.timestamp,
          views: info.views,
          upload: info.ago,
          thumbnail: info.thumbnail,
        };
      }

      // Check duration
      const [min, sec] = videoInfo.duration.split(":").map(Number);
      const totalSeconds = min * 60 + (sec || 0);
      if (totalSeconds > 1800) return reply("⏱️ Video limit is 30 minutes!");

      // Get downloadable link using youtube-dl-exec
      const result = await youtubedl(videoUrl, {
        format: "18", // mp4 360p (common format)
        getUrl: true,
      });

      const caption = `
❤️ SENAL MD Video Downloader 😚

👑 Title     : ${videoInfo.title}
⏱️ Duration  : ${videoInfo.duration}
👀 Views     : ${videoInfo.views}
📤 Uploaded  : ${videoInfo.upload}
🔗 URL       : ${videoUrl}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇
`;

      await robin.sendMessage(
        from,
        { image: { url: videoInfo.thumbnail }, caption },
        { quoted: mek }
      );

      await robin.sendMessage(
        from,
        {
          video: { url: result },
          mimetype: "video/mp4",
          caption: `🎬 ${videoInfo.title}`,
        },
        { quoted: mek }
      );

      await robin.sendMessage(
        from,
        {
          document: { url: result },
          mimetype: "video/mp4",
          fileName: `${videoInfo.title}.mp4`,
          caption: "𝐌𝐚𝐝𝐞 𝐛𝐲 𝙎𝙀𝙉𝘼𝙇",
        },
        { quoted: mek }
      );

      return reply("*✅ Video sent successfully!* 🌚❤️");
    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
