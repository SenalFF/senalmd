const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@vreden/youtube_scraper");
const axios = require("axios");

cmd(
  {
    pattern: "song",
    react: "🎵",
    desc: "Download Song",
    category: "download",
    filename: __filename,
  },
  async (
    robin,
    mek,
    m,
    { from, q, quoted, reply }
  ) => {
    try {
      if (!q) return reply("*නමක් හරි ලින්ක් එකක් හරි දෙන්න* 🌚❤️");

      await reply("🔍 Searching your song...");

      const search = await yts(q);
      const data = search.videos[0];

      if (!data || !data.videoId) return reply("❌ Video not found");

      const shortUrl = `https://youtu.be/${data.videoId}`;

      const desc = `
*❤️ SENAL MD SONG DOWNLOADER 😚*

🎧 *Title:* ${data.title}
🕒 *Duration:* ${data.timestamp}
👁️ *Views:* ${data.views}
📎 *URL:* ${shortUrl}

_𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇_
`;

      // Send metadata + thumbnail
      await robin.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      await reply("⬇️ Downloading MP3...");

      const song = await ytmp3(shortUrl, "mp3");

      // Download MP3 buffer
      const res = await axios.get(song.download.url, { responseType: "arraybuffer" });
      const audioBuffer = Buffer.from(res.data);
      const fileSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);

      await reply(`📤 Uploading file... (${fileSizeMB} MB)`);

      // Send as audio message
      await robin.sendMessage(
        from,
        {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${data.title}.mp3`,
          ptt: false,
        },
        { quoted: mek }
      );

      // Send also as document
      await robin.sendMessage(
        from,
        {
          document: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${data.title}.mp3`,
          caption: "📦 MP3 as Document\n_𝙈𝙖𝙙𝙚 𝙗𝙮 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇_",
        },
        { quoted: mek }
      );

      await reply("✅ *Done! Enjoy your song.* 🎶");

    } catch (e) {
      console.error("❌ Error in song command:", e);
      reply(`❌ Error: ${e.message}`);
    }
  }
);
