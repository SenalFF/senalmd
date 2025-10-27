const { cmd } = require("../command");
const axios = require("axios");

cmd({
  pattern: "ytm",
  alias: ["movie", "ytsmovie"],
  desc: "🎬 Search and download movies from YTS",
  category: "search",
  react: "🎥",
  filename: __filename
}, 
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Please provide a movie name.\n\n📌 Example: `.yts Interstellar`");

    reply("🔍 *Searching YTS for:* " + q + "\n⏳ Please wait...");

    const apiUrl = `https://yts-mx-alpha.vercel.app/api/v2/search?query=${encodeURIComponent(q)}`;
    const { data } = await axios.get(apiUrl);

    if (!data.data || !data.data.movies || data.data.movies.length === 0) {
      return reply(`❌ *No results found for:* ${q}\n\n💡 Try checking the spelling or search for a different movie.`);
    }

    const movie = data.data.movies[0];

    const title = movie.title || "Unknown";
    const year = movie.year || "N/A";
    const rating = movie.rating || "N/A";
    const coverImage = movie.large_cover_image || movie.medium_cover_image || "";
    
    const torrents = movie.torrents || [];
    
    if (torrents.length === 0) {
      return reply(`❌ No download links available for *${title}*`);
    }

    let qualitiesText = "";
    let torrentsText = "";
    let seedrLinks = "";

    torrents.forEach((torrent, index) => {
      const quality = torrent.quality || "Unknown";
      const size = torrent.size || "N/A";
      const torrentUrl = torrent.url || "#";
      const hash = torrent.hash || "";

      if (index === 0) {
        qualitiesText = quality;
      } else {
        qualitiesText += `, ${quality}`;
      }

      torrentsText += `\n🔗 *${quality}:* ${torrentUrl}`;

      if (hash) {
        const seedrUrl = `https://www.seedr.cc/?magnet=magnet:?xt=urn:btih:${hash}`;
        seedrLinks += `\n⚡ *${quality}:* ${seedrUrl}`;
      }
    });

    const primarySize = torrents[0].size || "N/A";
    const sizeInfo = torrents.length > 1 
      ? `${torrents[0].size} / ${torrents[torrents.length - 1].size}` 
      : primarySize;

    const cleanText = (text) => text ? text.replace(/<[^>]*>/g, '') : "";

    const caption = `
────────────────────────────
🎬 *Title:* ${cleanText(title)}
📅 *Year:* ${year}
⭐ *IMDb:* ${rating}/10
🎥 *Quality:* ${qualitiesText}
📦 *Size:* ${sizeInfo}

*🔗 Torrent Links:*${torrentsText}

*⚡ Direct Download (Seedr):*${seedrLinks}
────────────────────────────
✨ *Developer:* Mr Senal | YTS.mx
────────────────────────────
    `.trim();

    if (coverImage) {
      await conn.sendMessage(from, {
        image: { url: coverImage },
        caption: caption
      }, { quoted: mek });
    } else {
      await reply(caption);
    }

  } catch (err) {
    console.error("Error in .yts command:", err);
    
    if (err.response) {
      reply(`❌ API Error: ${err.response.status}\n\n💡 The YTS API might be down. Try again later.`);
    } else if (err.request) {
      reply("❌ Network error. Please check your connection and try again.");
    } else {
      reply("❌ An error occurred while searching for the movie.\n\n" + err.message);
    }
  }
});
