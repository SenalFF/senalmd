const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { finished } = require("stream/promises");
const progress = require("progress-stream");

const MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16MB

// 📥 Download to temp file with progress
async function downloadWithProgress(url, tempPath, reply) {
  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
  });

  const total = parseInt(response.headers["content-length"]);
  const progressStream = progress({
    length: total,
    time: 1000, // update every second
  });

  progressStream.on("progress", (prog) => {
    reply(
      `📥 බාගැනීම: ${prog.percentage.toFixed(2)}% | ⌛ ${Math.round(prog.runtime)}s | 📦 ${(prog.transferred / (1024 * 1024)).toFixed(2)}MB`
    );
  });

  const writer = fs.createWriteStream(tempPath);
  response.data.pipe(progressStream).pipe(writer);
  await finished(writer);
}

// 📤 Send voice note
async function sendAudio(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      audio: buffer,
      mimetype: "audio/mpeg",
      ptt: true,
      fileName: `${title.slice(0, 30)}.mp3`,
    },
    { quoted: mek }
  );
}

// 📤 Send as document
async function sendDocument(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "audio/mpeg",
      fileName: `${title.slice(0, 30)}.mp3`,
      caption: "✅ 𝐃𝐨𝐜𝐮𝐦𝐞𝐧𝐭 𝐒𝐞𝐧𝐭 𝐛𝐲 *SENAL MD* 🔥",
    },
    { quoted: mek }
  );
}

// 🔍 Normalize YouTube input
function normalizeYouTubeInput(text) {
  const ytRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/\S+/;
  return ytRegex.test(text) ? text : null;
}

// ▶️ .play command
cmd(
  {
    pattern: "play",
    desc: "🎧 YouTube Audio Downloader",
    category: "download",
    react: "🎧",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 *කරුණාකර ගීත නමක් හෝ YouTube ලින්ක් එකක් ලබා දෙන්න.*");

      await reply("🔎 _සොයමින් පවතී..._");

      let url = normalizeYouTubeInput(q);
      let video;

      if (url) {
        url = url.trim().replace(/[\[\]\(\)'"]/g, "");
        let videoId;
        try {
          videoId = new URL(url).searchParams.get("v");
        } catch {
          return reply("❌ *වැරදි YouTube ලින්ක් එකක් දැමූවේය.*");
        }
        const search = await yts({ videoId });
        video = search?.videos?.[0];
      } else {
        const search = await yts(q);
        video = search.videos[0];
        url = video?.url;
      }

      if (!video || !url) return reply("❌ *ගීතය හමු නොවීය.*");

      const title = video.title;

      // Send song details
      const info = `
🎵 ──✨ *SENAL MD* ✨──

🎶 *Title:* ${title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📅 *Uploaded:* ${video.ago}
💾 *Size:* _බාගැනීමෙන් පසු_

🔗 *Link:* ${url}
⏬ _බාගැනීම ආරම්භ වෙයි..._
`.trim();

      await robin.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption: info },
        { quoted: mek }
      );

      const result = await ytmp3(url, "mp3");
      if (!result?.download?.url) return reply("❌ *බාගැනීම අසාර්ථකයි.*");

      const tempPath = path.join(__dirname, "../temp", `senalmd_${Date.now()}.mp3`);
      await downloadWithProgress(result.download.url, tempPath, reply);

      const buffer = fs.readFileSync(tempPath);
      const fileSize = buffer.length;
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

      await reply(`📤 _(${fileSizeMB}MB) යැවීමට සූදානම්..._`);

      if (fileSize <= MAX_AUDIO_SIZE) {
        await sendAudio(robin, from, mek, buffer, title);
        await reply("✅ *🎧 Voice Note සාර්ථකව යැවුණි!*");
      } else {
        await sendDocument(robin, from, mek, buffer, title);
        await reply("✅ *📄 Document සාර්ථකව යැවුණි!*");
      }

      fs.unlinkSync(tempPath); // 🧼 Delete temp file

    } catch (e) {
      console.error("Play Command Error:", e);
      await reply("❌ *බාගැනීම අසාර්ථකයි. SENAL MD හරහා නැවත උත්සාහ කරන්න.*");
    }
  }
);
