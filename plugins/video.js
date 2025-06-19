const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp4 } = require("@vreden/youtube_scraper");
const axios = require("axios");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { Readable } = require("stream");

cmd({
  pattern: "video2",
  desc: "Stream YouTube video and send",
  category: "download",
  react: "🎥",
  filename: __filename,
},
async (conn, mek, m, { q, from, reply }) => {
  try {
    if (!q) return reply("*🔍 කරුණාකර නමක් හෝ ලින්ක් එකක් ලබා දෙන්න.*");

    const search = await yts(q);
    const video = search.videos[0];
    const url = video.url;

    const info = await ytmp4(url);
    const videoUrl = info.download.url;

    // Download video stream
    const { data: videoStream } = await axios.get(videoUrl, {
      responseType: "stream"
    });

    reply("🎬 *Streaming video through FFmpeg...*");

    // Start ffmpeg process with input from stream and output to pipe
    const ffmpeg = spawn(ffmpegPath, [
      "-i", "pipe:0",
      "-f", "mp4",
      "-vcodec", "copy",
      "-acodec", "copy",
      "pipe:1"
    ]);

    videoStream.pipe(ffmpeg.stdin);

    let chunks = [];
    ffmpeg.stdout.on("data", chunk => chunks.push(chunk));

    ffmpeg.on("close", async code => {
      if (code !== 0) return reply("❌ FFmpeg process failed");

      const finalBuffer = Buffer.concat(chunks);

      await conn.sendMessage(
        from,
        {
          video: finalBuffer,
          mimetype: "video/mp4",
          caption: `🎞️ *${video.title}*\n© 𝚂𝙴𝙽𝙰𝙻-𝙼𝙳`,
        },
        { quoted: mek }
      );

      reply("✅ *Uploaded without saving locally!*");
    });

    ffmpeg.stderr.on("data", err => console.log("FFmpeg:", err.toString()));

  } catch (err) {
    console.error(err);
    reply(`🚫 *දෝෂයක් ඇති විය:*\n${err.message}`);
  }
})
