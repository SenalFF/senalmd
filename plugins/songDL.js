const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper");
const { DownloaderHelper } = require("node-downloader-manager");
const fs = require("fs");
const path = require("path");
const os = require("os");

const MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16MB WhatsApp voice note limit

// Fast file download using node-downloader-manager
async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const tmpPath = path.join(os.tmpdir(), `senal_${Date.now()}.mp3`);
    const dl = new DownloaderHelper(url, path.dirname(tmpPath), {
      fileName: path.basename(tmpPath),
      retry: { maxRetries: 2, delay: 2000 },
      timeout: 30000,
    });

    dl.on("end", () => {
      const buffer = fs.readFileSync(tmpPath);
      fs.unlinkSync(tmpPath); // Clean up
      resolve(buffer);
    });

    dl.on("error", (err) => {
      reject(err);
    });

    dl.start();
  });
}

function normalizeYouTubeInput(text) {
  const ytRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/\S+/;
  return ytRegex.test(text) ? text : null;
}

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

// .play command
cmd(
  {
    pattern: "song",
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
      const filesizeMB = "බාගැනීමෙන් පසු ගණන් කරනු ලැබේ.";

      const info = `
🎵 ─── ✨ SENAL MD - YT MP3 ✨ ─── 🎵

🎶 Title   : *${title}*
⏰ Duration: *${video.timestamp}*
👁️ Views  : *${video.views.toLocaleString()}*
📅 Uploaded: *${video.ago}*
💾 Size    : *${filesizeMB}*

🔗 Link:
${url}

⏬ Download starting...
`.trim();

      await robin.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption: info },
        { quoted: mek }
      );

      const result = await ytmp3(url, "mp3");
      if (!result?.download?.url) return reply("❌ *බාගැනීම අසාර්ථකයි.*");

      const buffer = await downloadFile(result.download.url);
      const filesize = buffer.length;
      const realFilesizeMB = (filesize / (1024 * 1024)).toFixed(2);

      await reply(`📤 _ගීතය (${realFilesizeMB}MB) SENAL MD හරහා යැවෙමින් පවතී..._`);

      if (filesize <= MAX_AUDIO_SIZE) {
        await sendAudio(robin, from, mek, buffer, title);
        await reply("✅ *🎧 Voice Note සාර්ථකව SENAL MD හරහා යැවුණි!* 🎶");
      } else {
        await reply("⚠️ *🔊 Voice Note ලෙස SENAL MD හරහා යැවිය නොහැක!*\n📁 _ගිණුම විශාලයි (>16MB)._ \n➡️ _Document ආකාරයෙන් යැවෙමින් පවතී..._");
        await sendDocument(robin, from, mek, buffer, title);
        await reply("✅ *📄 Document සාර්ථකව SENAL MD හරහා යැවුණි!* 📁");
      }
    } catch (e) {
      console.error("Play Command Error:", e);
      await reply("❌ *බාගැනීම අසාර්ථකයි. SENAL MD හරහා නැවත උත්සාහ කරන්න.*");
    }
  }
);
