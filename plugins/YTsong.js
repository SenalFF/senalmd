const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16MB WhatsApp limit

// Download file using axios
async function downloadFile(url) {
  try {
    const res = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(res.data);
  } catch (err) {
    throw new Error("❌ බාගැනීම අසාර්ථකයි.");
  }
}

// Normalize input (YouTube link or search text)
function normalizeYouTubeInput(text) {
  const ytRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/\S+/;
  return ytRegex.test(text) ? text : null;
}

// Send voice note
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

// Send as document
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
    pattern: "play",
    desc: "🎧 YouTube Audio Downloader",
    category: "download",
    react: "🎧",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🔍 *කරුණාකර ගීත නමක් හෝ YouTube ලින්ක් එකක් දෙන්න.*");

      await reply("🔎 _සොයමින් පවතී..._");

      let url = normalizeYouTubeInput(q);
      let video;

      if (url) {
        const videoId = new URL(url).searchParams.get("v");
        const search = await yts({ videoId });
        video = search?.videos?.[0];
      } else {
        const search = await yts(q);
        video = search.videos[0];
        url = video?.url;
      }

      if (!video || !url) return reply("❌ *ගීතය හමු නොවීය.*");

      const title = video.title;

      await reply("⏬ _බාගැනීම සකසමින්..._");

      const result = await ytmp3(url, "128");
      if (!result?.download?.url) return reply("❌ *බාගැනීම අසාර්ථකයි.*");

      const buffer = await downloadFile(result.download.url);
      const filesize = buffer.length;
      const filesizeMB = (filesize / (1024 * 1024)).toFixed(2);

      const info = `
🎧 *𝐘𝐨𝐮𝐓𝐮𝐛𝐞 𝐌𝐏𝟑 𝐁𝐲 SENAL MD*

🎵 *Title:* ${title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📤 *Uploaded:* ${video.ago}
📦 *File Size:* ${filesizeMB} MB
🔗 *Link:* ${url}
      `.trim();

      await robin.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption: info },
        { quoted: mek }
      );

      await reply("📤 _යැවෙමින් පවතී..._");

      if (filesize <= MAX_AUDIO_SIZE) {
        await sendAudio(robin, from, mek, buffer, title);
        await reply("✅ *🎧 Voice Note සාර්ථකව යැවුණි!*");
      } else {
        await reply("⚠️ *🔊 Voice Note ලෙස යැවිය නොහැක!*\n📁 _ගිණුම විශාලයි (>16MB)._ \n➡️ _Document ආකාරයෙන් යැවෙමින් පවතී..._");
        await sendDocument(robin, from, mek, buffer, title);
        await reply("✅ *📄 Document සාර්ථකව යැවුණි!*");
      }

    } catch (e) {
      console.error("Play Command Error:", e);
      await reply("❌ *දෝෂයක් සිදුවිය. කරුණාකර නැවත උත්සාහ කරන්න.*");
    }
  }
);
