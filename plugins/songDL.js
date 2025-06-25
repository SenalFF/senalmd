const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@vreden/youtube_scraper");
const axios = require("axios");
const fs = require("fs");

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
    {
      from,
      quoted,
      q,
      reply,
    }
  ) => {
    try {
      if (!q) return reply("*නමක් හරි ලින්ක් එකක් හරි දෙන්න* 🌚❤️");

      // Search YouTube
      const search = await yts(q);
      const data = search.videos[0];
      const url = data.url;

      // Create song details message
      const desc = `
*❤️SENAL MD SONG DOWNLOADER😚*

👻 *title* : ${data.title}
👻 *description* : ${data.description}
👻 *time* : ${data.timestamp}
👻 *ago* : ${data.ago}
👻 *views* : ${data.views}
👻 *url* : ${data.url}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇
`;

      // Send video thumbnail and details
      await robin.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      // Download audio
      const quality = "128";
      const songData = await ytmp3(url, quality);

      // Validate duration
      let durationParts = data.timestamp.split(":").map(Number);
      let totalSeconds =
        durationParts.length === 3
          ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
          : durationParts[0] * 60 + durationParts[1];

      if (totalSeconds > 1800) {
        return reply("⏱️ Audio limit is 30 minutes");
      }

      // Fetch audio file as buffer
      const audioRes = await axios.get(songData.download.url, {
        responseType: "arraybuffer",
      });
      const audioBuffer = Buffer.from(audioRes.data);

      // Get file size (in MB)
      const fileSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);

      // Send details before sending file
      await reply(`🎧 *Sending...*\n\n📁 *Title:* ${data.title}\n📦 *Size:* ${fileSizeMB} MB`);

      // Send audio as voice message
      await robin.sendMessage(
        from,
        {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          ptt: false,
          fileName: `${data.title}.mp3`,
        },
        { quoted: mek }
      );

      // Also send as document (optional)
      await robin.sendMessage(
        from,
        {
          document: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${data.title}.mp3`,
          caption: "𝐌𝐚𝐝𝐞 𝐛𝐲 𝙎𝙀𝙉𝘼𝙇",
        },
        { quoted: mek }
      );

      return reply("*✅ Sent successfully* 🌚❤️");

    } catch (e) {
      console.error("❌ ERROR in .song:", e);
      reply(`❌ Error: ${e.message}`);
    }
  }
);
