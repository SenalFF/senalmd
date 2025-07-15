const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_VOICE_NOTE = 16 * 1024 * 1024;
const sessions = {}; // To track pending confirmations

// 🔗 Stream buffer directly from URL
async function streamAudioBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// 🎵 Send audio
async function sendAudio(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      audio: buffer,
      mimetype: "audio/mpeg",
      ptt: buffer.length <= MAX_VOICE_NOTE,
      fileName: `${title.slice(0, 30)}.mp3`,
    },
    { quoted: mek }
  );
}

// 📍 YouTube input normalizer
function normalizeYouTubeInput(text) {
  const ytRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/\S+/;
  return ytRegex.test(text) ? text : null;
}

// ▶️ Step 1: .play command — send details only
cmd(
  {
    pattern: "play",
    desc: "🎧 YouTube Audio Info",
    category: "download",
    react: "🎵",
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("❗Please provide a song name or YouTube link.");

      await reply("🔍 Searching...");

      let url = normalizeYouTubeInput(q);
      let video;

      if (url) {
        url = url.trim().replace(/[\[\]\(\)'"]/g, "");
        let videoId;
        try {
          videoId = new URL(url).searchParams.get("v");
        } catch {
          return reply("❌ Invalid YouTube link.");
        }
        const search = await yts({ videoId });
        video = search?.videos?.[0];
      } else {
        const search = await yts(q);
        video = search.videos[0];
        url = video?.url;
      }

      if (!video || !url) return reply("❌ No results found.");

      const title = video.title;

      // Save session for .yes command
      sessions[from] = {
        title,
        url,
        thumbnail: video.thumbnail,
      };

      const info = `
🎧 ━━━ 『 *SENAL MD* YouTube Audio 』 ━━━

🎵 *Title:* ${title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views.toLocaleString()}
📅 *Uploaded:* ${video.ago}
🔗 *Link:* ${url}

💬 *Type* \`.yes\` *to start downloading...*
`.trim();

      await robin.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption: info },
        { quoted: mek }
      );

    } catch (err) {
      console.error("Play Error:", err);
      return reply("❌ Failed to fetch video info.");
    }
  }
);

// ▶️ Step 2: .yes command — start downloading and sending
cmd(
  {
    pattern: "yes",
    desc: "📥 Confirm and Download Audio",
    category: "download",
    react: "⬇️",
  },
  async (robin, mek, m, { from, reply }) => {
    try {
      const session = sessions[from];
      if (!session) return reply("❌ No pending download. Use `.play <song>` first.");

      await reply("📥 Downloading audio...");

      const result = await ytmp3(session.url, "mp3");
      if (!result?.download?.url) return reply("❌ Failed to get download link.");

      const buffer = await streamAudioBuffer(result.download.url);

      await reply("📤 Uploading to WhatsApp...");

      await sendAudio(robin, from, mek, buffer, session.title);

      await reply("✅ Audio sent successfully via *SENAL MD*!");

      delete sessions[from];

    } catch (err) {
      console.error("Download Error:", err);
      return reply("❌ Download failed. Please try again.");
    }
  }
);
