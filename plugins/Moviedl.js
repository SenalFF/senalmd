const { cmd } = require("../command"); // adjust if your command loader path is different
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
    if (!q)
      return reply(
        "🎬 *කරුණාකර චිත්‍රපටයේ නමක් ලබා දෙන්න.*\n\n_උදා: `.mdl O2`_"
      );

    try {
      const movie = await sinhalaSub();
      const search = await movie.search(q);

      if (!search?.result || search.result.length === 0)
        return reply("❌ සිංහල උපසිරැසි සහිත චිත්‍රපටය හමු නොවීය!");

      const selected = search.result[0]; // You can modify this to let users choose
      const details = await movie.download(selected.link);
      const info = details.result;

      const best = info.direct_links?.[0];
      if (!best || !best.link)
        return reply("❌ Direct download link not found!");

      // HEAD request for content length
      const head = await axios.head(best.link).catch(() => null);
      const byteSize = head?.headers["content-length"]
        ? parseInt(head.headers["content-length"])
        : null;

      const sizeFormatted = byteSize
        ? (byteSize / (1024 * 1024) > 1024
            ? (byteSize / (1024 * 1024 * 1024)).toFixed(2) + " GB"
            : (byteSize / (1024 * 1024)).toFixed(1) + " MB")
        : best.size || "Unknown";

      // Step 1: Send movie info
      await robin.sendMessage(
        from,
        {
          image: { url: info.image },
          caption:
            `🎬 *${info.title}*\n` +
            `📅 Date: ${info.date}\n` +
            `🌍 Country: ${info.country}\n` +
            `🕒 Duration: ${info.duration}\n` +
            `🎭 Genre: ${info.genres?.join(", ") || "N/A"}\n` +
            `⭐ IMDB: ${info.IMDB || "N/A"}\n` +
            `📦 Quality: ${best.quality}\n` +
            `💾 Size: ${sizeFormatted}\n\n` +
            `_⬇️ Uploading will start now..._`,
        },
        { quoted: mek }
      );

      // Step 2: Send "uploading" text
      const uploading = await robin.sendMessage(
        from,
        {
          text: `📥 *Uploading movie file...*\n🎞️ *${info.title}*\n💾 *${sizeFormatted}* ⏳`,
        },
        { quoted: mek }
      );

      // Step 3: Download & stream
      const start = Date.now();
      const res = await axios({
        url: best.link,
        method: "GET",
        responseType: "stream",
      });

      const stream = new PassThrough();
      res.data.pipe(stream);

      await robin.sendMessage(
        from,
        {
          document: { stream },
          mimetype: "video/mp4",
          fileName: `${info.title}.mp4`,
          caption: `🎬 *${info.title}*\n📦 ${best.quality} | ${sizeFormatted}\n✅ Sinhala Sub Movie by SENAL-MD`,
        },
        { quoted: mek }
      );

      const end = Date.now();
      const timeTaken = ((end - start) / 1000).toFixed(1);

      // Step 4: Completion message
      await robin.sendMessage(
        from,
        {
          text: `✅ *Uploaded successfully!*\n📽️ *${info.title}*\n⏱️ Time taken: *${timeTaken}s*`,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error(err);
      return reply("🚫 *Movie download failed!* නිවැරදි නමක් ලබාදෙන්න.");
    }
  }
);
