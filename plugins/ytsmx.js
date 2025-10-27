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
    // Check if query exists
    if (!q) return reply("❗ Please provide a movie name.\n\n📌 Example: `.yts Interstellar`");

    // Show searching message
    reply("🔍 *Searching YTS for:* " + q + "\n⏳ Please wait...");

    // Fetch from YTS API
    const apiUrl = `https://yts-mx-alpha.vercel.app/api/v2/search?query=${encodeURIComponent(q)}`;
    const { data } = await axios.get(apiUrl);

    // Check if results exist
    if (!data.data || !data.data.movies || data.data.movies.length === 0) {
      return reply(`❌ *No results found for:* ${q}\n\n💡 Try checking the spelling or search for a different movie.`);
    }

    // Get the best match (first result)
    const movie = data.data.movies[0];

    // Extract movie details
    const title = movie.title || "Unknown";
    const year = movie.year || "N/A";
    const rating = movie.rating || "N/A";
    const coverImage = movie.large_cover_image || movie.medium_cover_image || "";
    
    // Get available torrents (qualities)
    const torrents = movie.torrents || [];
    
    if (torrents.length === 0) {
      return reply(`❌ No download links available for *${title}*`);
    }

    // Format qualities, sizes, and links
    let qualitiesText = "";
    let torrentsText = "";
    let seedrLinks = "";

    torrents.forEach((torrent, index) => {
      const quality = torrent.quality || "Unknown";
      const size = torrent.size || "N/A";
      const torrentUrl = torrent.url || "#";
      const hash = torrent.hash || "";

      // Build quality list
      if (index === 0) {
        qualitiesText = quality;
      } else {
        qualitiesText += `, ${quality}`;
      }

      // Build torrent links
      torrentsText += `\n🔗 *${quality}:* ${torrentUrl}`;

      // Build Seedr direct download links (using hash)
      if (hash) {
        const seedrUrl = `https://www.seedr.cc/?magnet=magnet:?xt=urn:btih:${hash}`;
        seedrLinks += `\n⚡ *${quality}:* ${seedrUrl}`;
      }
    });

    // Get size info (from first torrent as primary)
    const primarySize = torrents[0].size || "N/A";
    const sizeInfo = torrents.length > 1 
      ? `${torrents[0].size} / ${torrents[torrents.length - 1].size}` 
      : primarySize;

    // Clean HTML tags if any (from synopsis or other fields)
    const cleanText = (text) => text ? text.replace(/<[^>]*>/g, '') : "";

    // Build caption
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

    // Send movie poster with info
    if (coverImage) {
      await conn.sendMessage(from, {
        image: { url: coverImage },
        caption: caption
      }, { quoted: mek });
    } else {
      // If no image, send text only
      await reply(caption);
    }

  } catch (err) {
    console.error("Error in .yts command:", err);
    
    // Better error handling
    if (err.response) {
      reply(`❌ API Error: ${err.response.status}\n\n💡 The YTS API might be down. Try again later.`);
    } else if (err.request) {
      reply("❌ Network error. Please check your connection and try again.");
    } else {
      reply("❌ An error occurred while searching for the movie.\n\n" + err.message);
    }
  }
});
```

## Key Features Implemented:

✅ **API Integration** - Fetches from `https://yts-mx-alpha.vercel.app/api/v2/search`  
✅ **Error Handling** - Handles no results, API errors, network issues  
✅ **Multiple Qualities** - Shows all available qualities (720p, 1080p, 2160p, etc.)  
✅ **Torrent Links** - Direct magnet links for each quality  
✅ **Seedr Integration** - Generates Seedr direct download links using torrent hash  
✅ **Image Message** - Sends movie poster with formatted caption  
✅ **Clean Output** - Removes HTML tags and formats text properly  
✅ **User Feedback** - Shows searching status and clear error messages

## Usage Examples:
```
.yts Interstellar
.yts The Dark Knight
.yts Inception
