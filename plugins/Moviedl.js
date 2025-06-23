const { cmd } = require("../command");
const { sinhalaSub } = require("mrnima-moviedl");
const axios = require("axios");
const { PassThrough } = require("stream");

cmd(
  {
    pattern: "mdl",
    desc: "🎬 Sinhala Movie Downloader (Stream to WhatsApp)",
    category: "movie",
    react: "📥",
  },
  async (robin, mek, m, { q, from, reply }) => {
    if (!q) return reply("🎬 *කරුණාකර චිත්‍රපටයේ නමක් ලබා දෙන්න.*\n\n_උදා: `.mdl O2`_");

    try {
      // Initialize movie downloader
      const movie = await sinhalaSub();

      // Search movie by name (q)
      const search = await movie.search(q);

      if (!search?.result || search.result.length === 0)
        return reply("❌ සිංහල උපසිරැසි සහිත චිත්‍රපටය හමු නොවීය!");

      // Select first search result
      const selected = search.result[0];

      // Download movie details
      const details = await movie.download(selected.link);
      const info = details.result;

      // Get best direct link (usually first one)
      const best = info.direct_links?.[0];

      if (!best || !best.link) return reply("❌ Direct download link not found!");

      // Get file size from HTTP HEAD request
      const head = await axios.head(best.link).catch(() => null);
      const byteSize = head?.headers["content-length"]
        ? parseInt(head.headers["content-length"])
        : null;

      // Format file size string
      const sizeFormatted = byteSize
        ? byteSize > 1024 * 1024 * 1024
          ? (byteSize / (1024 * 1024 * 1024)).toFixed(2) + " GB"
          : (byteSize / (1024 * 1024)).toFixed(1) + " MB"
        : best.size || "Unknown";

      // Send movie info with poster image
      await robin.sendMessage(from, {
        image: { url: info.image || "" },
        caption:
          `🎬 *${info.title || "Unknown Title"}*\n` +
          `📅 Date: ${info.date || "Unknown"}\n` +
          `🌍 Country: ${info.country || "Unknown"}\n` +
          `🕒 Duration: ${info.duration || "Unknown"}\n` +
          `🎭 Genre: ${info.genres?.join(", ") || "N/A"}\n` +
          `⭐ IMDB: ${info.IMDB || "N/A"}\n` +
          `📦 Quality: ${best.quality || "Unknown"}\n` +
          `💾 Size: ${sizeFormatted}\n\n` +
          `_⬇️ Uploading will start now..._`,
      }, { quoted: mek });

      // Notify uploading start
      await robin.sendMessage(from, {
        text: `📥 *Uploading movie file...*\n🎞️ *${info.title || "Movie"}*\n💾 *${sizeFormatted}* ⏳`,
      }, { quoted: mek });

      // Download movie file as stream
      const response = await axios({
        url: best.link,
        method: "GET",
        responseType: "stream",
      });

      const stream = new PassThrough();
      response.data.pipe(stream);

      // Send the video document with caption
      await robin.sendMessage(from, {
        document: stream,
        mimetype: "video/mp4",
        fileName: `${info.title || "movie"}.mp4`,
        caption: `🎬 *${info.title || "Movie"}*\n📦 ${best.quality || "Unknown"} | ${sizeFormatted}\n✅ Sinhala Sub Movie by SENAL-MD`,
      }, { quoted: mek });

      // Optional: Send success message or stats if needed

    } catch (error) {
      console.error(error);
      reply("❌ කණගාටුයි, චිත්‍රපටය ලබා ගැනීමට අසමත් විය.");
    }
  }
);
