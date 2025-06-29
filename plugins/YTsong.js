const { cmd } = require("../command");
const yts = require("yt-search");
const svdl = require("@blackamda/song_video_dl");

// ✅ Normalize YouTube URL
function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

// 🎧 .play command (MP3)
cmd(
  {
    pattern: "play",
    react: "🎧",
    desc: "Download YouTube Music Audio",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("*🔎 නමක් හරි ලින්ක් එකක් හරි දෙන්න*");

      let videoUrl = "";
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
      } else {
        const search = await yts(q);
        const result = search.videos[0];
        if (!result) return reply("❌ ගීතය හමු නොවීය.");
        videoUrl = result.url;
      }

      const config = {
        type: "audio",
        quality: 128,
        server: "en68",
      };

      const audioInfo = await svdl.download(videoUrl, config);

      const caption = `
*❤️ SENAL MD Song Downloader 😍*

🎶 *Title*     : ${audioInfo.title}
📦 *Size*      : ${audioInfo.size}
🎧 *Quality*   : MP3
🔗 *URL*       : ${videoUrl}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇 🎧`;

      await robin.sendMessage(
        from,
        { image: { url: audioInfo.thumb }, caption },
        { quoted: mek }
      );

      await robin.sendMessage(
        from,
        {
          audio: { url: audioInfo.link },
          mimetype: "audio/mpeg",
          fileName: `${audioInfo.title}.mp3`,
        },
        { quoted: mek }
      );

      return reply("✅ *Song sent successfully!*");
    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);

// 📽️ .video command (MP4)
cmd(
  {
    pattern: "video2",
    react: "📽️",
    desc: "Download YouTube Video",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("*🔎 නමක් හරි ලින්ක් එකක් හරි දෙන්න*");

      let videoUrl = "";
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
      } else {
        const search = await yts(q);
        const result = search.videos[0];
        if (!result) return reply("❌ වීඩියෝව හමු නොවීය.");
        videoUrl = result.url;
      }

      const config = {
        type: "video",
        quality: 360,
        server: "en68",
      };

      const videoInfo = await svdl.download(videoUrl, config);

      const caption = `
*🎬 SENAL MD Video Downloader 📽️*

🎞️ *Title*     : ${videoInfo.title}
📦 *Size*      : ${videoInfo.size}
🎥 *Quality*   : 360p
🔗 *URL*       : ${videoUrl}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇 🎧`;

      await robin.sendMessage(
        from,
        { image: { url: videoInfo.thumb }, caption },
        { quoted: mek }
      );

      await robin.sendMessage(
        from,
        {
          video: { url: videoInfo.link },
          mimetype: "video/mp4",
          fileName: `${videoInfo.title}.mp4`,
        },
        { quoted: mek }
      );

      return reply("✅ *Video sent successfully!*");
    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
