// ================= Required Modules =================
const { cmd } = require("../command");
const yts = require("yt-search");
const ytdl = require("ytdl-core");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const sessions = {};
const VIDEO_QUALITIES = ["360p", "480p", "720p", "1080p"];
const INLINE_LIMIT = 90 * 1024 * 1024; // 90MB for inline video

// Helper: merge audio + video
function mergeAudioVideo(videoPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-i", videoPath,
      "-i", audioPath,
      "-c:v", "copy",
      "-c:a", "aac",
      "-y",
      outputPath,
    ];

    const ff = spawn(ffmpegPath, args);
    ff.stderr.on("data", (data) => console.log(data.toString()));
    ff.on("close", (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });
}

// Helper: download YouTube video/audio streams
async function downloadStreams(url, quality) {
  const info = await ytdl.getInfo(url);
  // Select video format for requested quality
  const videoFormat = ytdl.chooseFormat(info.formats, {
    quality: "highestvideo",
    filter: (f) => f.qualityLabel === quality && f.hasVideo && f.hasAudio === false,
  });

  // Fallback if quality not found
  if (!videoFormat) throw new Error("Quality not available");

  const audioFormat = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });

  // Temp file paths
  const tempVideo = path.join(__dirname, `temp_video_${Date.now()}.mp4`);
  const tempAudio = path.join(__dirname, `temp_audio_${Date.now()}.mp4`);
  const output = path.join(__dirname, `output_${Date.now()}.mp4`);

  // Download video and audio
  await new Promise((res, rej) => {
    ytdl(url, { format: videoFormat })
      .pipe(fs.createWriteStream(tempVideo))
      .on("finish", res)
      .on("error", rej);
  });

  await new Promise((res, rej) => {
    ytdl(url, { format: audioFormat })
      .pipe(fs.createWriteStream(tempAudio))
      .on("finish", res)
      .on("error", rej);
  });

  // Merge
  await mergeAudioVideo(tempVideo, tempAudio, output);

  // Cleanup
  fs.unlinkSync(tempVideo);
  fs.unlinkSync(tempAudio);

  return output;
}

// ================= Command: .video =================
cmd({
  pattern: "videodl",
  desc: "📥 YouTube Video Downloader",
  category: "download",
  react: "📹",
}, async (conn, mek, m, { q, reply }) => {
  if (!q) return reply("🔍 Please enter video name or URL.");

  await reply("🔎 Searching YouTube...");
  const searchResult = await yts(q);
  const video = searchResult.videos[0];
  if (!video) return reply("❌ Video not found.");

  // Save session
  sessions[mek.key.remoteJid] = { video, step: "choose_format" };

  const buttons = VIDEO_QUALITIES.map(qt => ({
    buttonId: `.video_select ${qt}`,
    buttonText: { displayText: qt },
    type: 1
  }));

  const info = `
🎬 *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *URL:* ${video.url}

Select video quality:`;

  await conn.sendMessage(mek.key.remoteJid, {
    image: { url: video.thumbnail },
    caption: info,
    buttons,
    headerType: 4
  }, { quoted: mek });
});

// ================= Command: .video_select =================
cmd({
  pattern: "video_select",
  desc: "Select video quality",
  dontAddCommandList: true
}, async (conn, mek, m, { q, reply }) => {
  const session = sessions[mek.key.remoteJid];
  if (!session || session.step !== "choose_format") return;
  session.step = "downloading";

  const quality = q.trim();
  await reply(`⏬ Downloading video at ${quality}...`);

  try {
    const outputFile = await downloadStreams(session.video.url, quality);
    const stats = fs.statSync(outputFile);

    if (stats.size > INLINE_LIMIT) {
      await conn.sendMessage(mek.key.remoteJid, {
        document: fs.readFileSync(outputFile),
        fileName: `${session.video.title}.mp4`,
        mimetype: "video/mp4",
        caption: "✅ Video sent as document due to large size",
      }, { quoted: mek });
    } else {
      await conn.sendMessage(mek.key.remoteJid, {
        video: fs.readFileSync(outputFile),
        mimetype: "video/mp4",
        fileName: `${session.video.title}.mp4`,
        caption: "✅ Video sent inline",
      }, { quoted: mek });
    }

    fs.unlinkSync(outputFile);
    delete sessions[mek.key.remoteJid];
  } catch (err) {
    console.error(err);
    reply("❌ Failed to download video. Quality may not be available.");
  }
});
