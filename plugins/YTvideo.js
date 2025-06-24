const { cmd } = require("../command");
const yts = require("yt-search");
const youtubedl = require("youtube-dl-exec");

// ✅ YouTube URL Normalizer
function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

// ✅ YouTube Video Info Downloader using youtube-dl
async function ytmp4(url) {
  try {
    const output = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });

    return {
      title: output.title,
      duration: formatDuration(output.duration), // in seconds → mm:ss
      views: output.view_count,
      upload: output.upload_date,
      thumbnail: output.thumbnail,
      video: output.url, // Direct URL
    };
  } catch (error) {
    throw new Error("Failed to fetch video info!");
  }
}

// ✅ Format seconds to mm:ss
function formatDuration(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}

// ✅ Main Bot Command
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
      let videoInfo = {};
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
        videoInfo = await ytmp4(videoUrl);
      } else {
        const search = await yts(q);
        const result = search.videos[0];
        if (!result) return reply("❌ Video not found, try another name.");
        videoUrl = result.url;
        videoInfo = await ytmp4(videoUrl);
      }

      const [min, sec] = videoInfo.duration.split(":").map(Number);
      const totalSeconds = min * 60 + (sec || 0);
      if (totalSeconds > 1800)
        return reply("⏱️ Video limit is 30 minutes!");

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
          video: { url: videoInfo.video },
          mimetype: "video/mp4",
          caption: `🎬 ${videoInfo.title}`,
        },
        { quoted: mek }
      );

      await robin.sendMessage(
        from,
        {
          document: { url: videoInfo.video },
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
