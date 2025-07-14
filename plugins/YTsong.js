const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16MB for WhatsApp voice note

// 📥 Download file directly into memory (no local save)
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// 🔍 Check if it's a YouTube link
function normalizeYouTubeInput(text) {
  const ytRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/\S+/;
  return ytRegex.test(text) ? text : null;
}

// 🎧 Send audio as voice note
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

// 📄 Send audio as document
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
        url = url.trim().replace(/[\[\]\(\)'"]/g, ""); // 🧼 sanitize broken links

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

      // 🧾 Details preview message
      const info = `
🎵 ─── ✨ SENAL MD - YT MP3 ✨ ─── 🎵

🎶 Title   : *${title}*
⏰ Duration: *${video.timestamp}*
👁️ Views  : *${video.views.toLocaleString()}*
📅 Uploaded: *${video.ago}*
💾 Size    : _බාගැනීමෙන් පසු තහවුරු වේ_

🔗 Link:
${url}

⏬ Downloading, please wait...
`.trim();

      await robin.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption: info },
        { quoted: mek }
      );

      // 🛠 Get MP3 download URL using scraper
      const result = await ytmp3(url, "mp3");
      if (!result?.download?.url) return reply("❌ *බාගැනීම අසාර්ථකයි.*");

      const buffer = await downloadFile(result.download.url);
      const filesize = buffer.length;
      const realFilesizeMB = (filesize / (1024 * 1024)).toFixed(2);

      await reply(`📤 _ගීතය (${realFilesizeMB}MB) SENAL MD හරහා යැවෙමින් පවතී..._`);

      // ✅ Stream to WhatsApp without saving
      if (filesize <= MAX_AUDIO_SIZE) {
        await sendAudio(robin, from, mek, buffer, title);
        await reply("✅ *🎧 Voice Note සාර්ථකව SENAL MD හරහා යැවුණි!* 🎶");
      } else {
        await reply("⚠️ *🔊 Voice Note ලෙස යැවිය නොහැක!* (>16MB)\n➡️ _Document ආකාරයෙන් යැවෙමින් පවතී..._");
        await sendDocument(robin, from, mek, buffer, title);
        await reply("✅ *📄 Document සාර්ථකව SENAL MD හරහා යැවුණි!*");
      }
    } catch (e) {
      console.error("Play Command Error:", e);
      await reply("❌ *බාගැනීම අසාර්ථකයි. SENAL MD හරහා නැවත උත්සාහ කරන්න.*");
    }
  }
);
