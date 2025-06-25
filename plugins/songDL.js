const { cmd } = require("../command");
const yts = require("yt-search");
const youtubedl = require("youtube-dl-exec");
const axios = require("axios");
const path = require("path");

const COOKIES_PATH = path.resolve(__dirname, "../system/cookies.txt");
const SIZE_LIMIT = 16 * 1024 * 1024; // 16MB in bytes

// ✅ Normalize YouTube URL
function normalizeYouTubeUrl(input) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

// ✅ Convert bytes to readable MB
function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

// ✅ Main handler
cmd(
  {
    pattern: "play",
    react: "🎵",
    desc: "Download YouTube MP3",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply, isReply }) => {
    try {
      if (!q) return reply("🔍 නමක් හෝ YouTube ලිンクයක් දෙන්න!");

      // ✅ Determine video URL and get info
      let videoUrl = "";
      let videoInfo = null;
      const normalizedUrl = normalizeYouTubeUrl(q);

      if (normalizedUrl) {
        videoUrl = normalizedUrl;
      } else {
        const search = await yts(q);
        if (!search.videos.length) return reply("❌ ගීතය හමු නොවුණා.");
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

      // ✅ Get direct MP3 URL using yt-dlp
      const audioUrl = await youtubedl(videoUrl, {
        extractAudio: true,
        audioFormat: "mp3",
        getUrl: true,
        cookies: COOKIES_PATH,
      });

      // ✅ Get file size from HEAD
      let fileSize = 0;
      let sizeText = "Unknown";
      try {
        const { headers } = await axios.head(audioUrl);
        fileSize = parseInt(headers["content-length"] || "0");
        sizeText = formatBytes(fileSize);
      } catch (err) {
        console.warn("⚠️ File size unavailable.");
      }

      // ✅ Compose message
      const caption = `
🎶 *SENAL MD Song Downloader*

🎧 *Title*     : ${videoInfo.title}
⏱️ *Duration*  : ${videoInfo.duration}
📁 *Size*      : ${sizeText}
👁️ *Views*     : ${videoInfo.views}
📤 *Uploaded*  : ${videoInfo.upload}
🔗 *URL*       : ${videoUrl}

_❤️ Made by 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇_
`;

      // ✅ Send thumbnail + details
      await robin.sendMessage(
        from,
        { image: { url: videoInfo.thumbnail }, caption },
        { quoted: mek }
      );

      // ✅ If replying to previous song message
      if (isReply && mek.message?.extendedTextMessage?.contextInfo) {
        const type = mek.message?.extendedTextMessage?.text?.toLowerCase();

        if (type.includes("1")) {
          if (fileSize < SIZE_LIMIT) {
            return await sendAudioPreview(robin, from, mek, audioUrl, videoInfo.title);
          } else {
            await reply("⚠️ මෙම ගීතය 16MBට වඩා විශාලයි.\n🎧 Document හැසිරවීමකට යටත් වේ.");
            return await sendAsDocument(robin, from, mek, audioUrl, videoInfo.title);
          }
        }

        if (type.includes("2")) {
          return await sendAsDocument(robin, from, mek, audioUrl, videoInfo.title);
        }
      }

      // ✅ Auto handle based on file size
      if (fileSize < SIZE_LIMIT) {
        await sendAudioPreview(robin, from, mek, audioUrl, videoInfo.title);
      } else {
        await reply("⚠️ මෙම ගීතය 16MBට වඩා විශාලයි. WhatsApp preview එකක් ලබාදිය නොහැක.");
        await sendAsDocument(robin, from, mek, audioUrl, videoInfo.title);

        await robin.sendMessage(
          from,
          {
            text: `✉️ ඔබට අවශ්‍ය ක්‍රමය තෝරන්න:\n\n*1.* 🎵 16MB ට අඩු -> *Audio Preview*\n*2.* 📄 Full File -> *Document* (No limit)\n\n_Reply with 1 or 2_`,
          },
          { quoted: mek }
        );
      }
    } catch (e) {
      console.error(e);
      return reply(`❌ වැරදි සිදුවුනා: ${e.message}`);
    }
  }
);

// ✅ Helper: Send Audio (Preview)
async function sendAudioPreview(robin, from, mek, url, title) {
  await robin.sendMessage(
    from,
    {
      audio: { url },
      mimetype: "audio/mpeg",
      fileName: `${title}.mp3`,
    },
    { quoted: mek }
  );
  return robin.sendMessage(from, { text: "✅ *MP3 Audio Sent (Preview)* 🎧" }, { quoted: mek });
}

// ✅ Helper: Send as Document
async function sendAsDocument(robin, from, mek, url, title) {
  await robin.sendMessage(
    from,
    {
      document: { url },
      mimetype: "audio/mpeg",
      fileName: `${title}.mp3`,
    },
    { quoted: mek }
  );
  return robin.sendMessage(from, { text: "✅ *MP3 File Sent as Document* 📄" }, { quoted: mek });
}
