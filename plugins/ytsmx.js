const { cmd } = require('../command');
const axios = require('axios');

const API_BASE = "https://mapi-beta.vercel.app";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1️⃣ SEARCH ENDPOINT - Search movies/TV shows
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  pattern: "cinesearch",
  alias: ["moviesearch", "csearch"],
  desc: "Search for movies/TV shows on CineSubz",
  category: "downloader",
  react: "🔍",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) {
      return reply(`❗ *Please provide a search query*

*Usage:* .cinesearch <movie name>
*Example:* .cinesearch Avatar`);
    }

    reply("🔍 *Searching CineSubz...*");

    // Call /search endpoint
    const searchUrl = `${API_BASE}/search?q=${encodeURIComponent(q)}`;
    const { data } = await axios.get(searchUrl);

    if (!data.results || data.results.length === 0) {
      return reply("❌ No results found for your search.");
    }

    // Format results with poster for first result
    let message = `🎬 *CineSubz Search Results*\n\n`;
    message += `🔎 Query: *${q}*\n`;
    message += `📊 Found: ${data.results.length} results\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    data.results.slice(0, 10).forEach((item, index) => {
      message += `*${index + 1}. ${item.title}*\n`;
      if (item.type) message += `   📁 Type: ${item.type}\n`;
      if (item.quality) message += `   📺 Quality: ${item.quality}\n`;
      if (item.rating) message += `   ⭐ Rating: ${item.rating}\n`;
      message += `   🔗 ${item.movie_url}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📌 *Next Step:*\n`;
    message += `Copy the URL and use:\n`;
    message += `.cinedetails <url>`;

    // Send with first result's poster
    const firstResult = data.results[0];
    if (firstResult && firstResult.poster_url) {
      await conn.sendMessage(from, {
        image: { url: firstResult.poster_url },
        caption: message
      }, { quoted: mek });
    } else {
      await conn.sendMessage(from, { text: message }, { quoted: mek });
    }

  } catch (e) {
    console.error("Search error:", e);
    reply(`❌ *Error:* ${e.message}`);
  }
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2️⃣ DETAILS ENDPOINT - Get movie/TV show details + download links
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  pattern: "cinedetails",
  alias: ["moviedetails", "cdetails", "cds"],
  desc: "Get movie/TV show details with download links",
  category: "downloader",
  react: "🎬",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) {
      return reply(`❗ *Please provide a CineSubz URL*

*Usage:* .cinedetails <url>
*Example:* .cinedetails https://cinesubz.co/movies/avatar-2022/`);
    }

    // Clean the input - remove command name if accidentally included
    let cleanUrl = q.trim();
    cleanUrl = cleanUrl.replace(/^(cinedetails|cdetails|cds)\s+/i, '');
    
    // Validate URL
    if (!cleanUrl.includes('cinesubz.lk') && !cleanUrl.includes('cinesubz.co')) {
      return reply("❌ Please provide a valid CineSubz URL (cinesubz.lk or cinesubz.co)");
    }

    reply("⏳ *Fetching details...*");

    // Call /details endpoint
    const detailsUrl = `${API_BASE}/details?url=${encodeURIComponent(cleanUrl)}`;
    const { data } = await axios.get(detailsUrl);

    if (!data || !data.movie_info) {
      return reply("❌ Failed to fetch details. Please try again.");
    }

    // Format details
    let message = `🎬 *${data.movie_info.title}*\n\n`;
    
    if (data.movie_info.year) message += `📅 *Year:* ${data.movie_info.year}\n`;
    if (data.movie_info.rating) message += `⭐ *Rating:* ${data.movie_info.rating}\n`;
    if (data.movie_info.genres && data.movie_info.genres.length > 0) {
      message += `🎭 *Genre:* ${data.movie_info.genres.join(', ')}\n`;
    }
    if (data.movie_info.type) message += `📁 *Type:* ${data.movie_info.type}\n`;
    
    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    if (data.movie_info.description && data.movie_info.description !== 'N/A') {
      const desc = data.movie_info.description.length > 300 
        ? data.movie_info.description.substring(0, 300) + '...' 
        : data.movie_info.description;
      message += `📝 *Description:*\n${desc}\n\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // If it's a TV show
    if (data.movie_info.type === "tvshow") {
      message += `📺 *This is a TV Show*\n\n`;
      message += `📌 *Get Episodes:*\n`;
      message += `.cineepisodes ${cleanUrl}`;
    } 
    // If it's a movie with download links
    else if (data.download_links && data.download_links.length > 0) {
      message += `📥 *Available Download Qualities:*\n\n`;
      
      data.download_links.forEach((link) => {
        message += `*${link.quality}*\n`;
        if (link.size) message += `💾 Size: ${link.size}\n`;
        message += `🔗 ${link.countdown_url}\n\n`;
      });

      message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `📌 *To Download:*\n`;
      message += `.cinedownload <countdown_url>`;
    } else {
      message += `❌ No download links available`;
    }

    // Send with image if available
    if (data.poster_url) {
      await conn.sendMessage(from, {
        image: { url: data.poster_url },
        caption: message
      }, { quoted: mek });
    } else {
      await conn.sendMessage(from, { text: message }, { quoted: mek });
    }

  } catch (e) {
    console.error("Details error:", e);
    reply(`❌ *Error:* ${e.message}`);
  }
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3️⃣ EPISODES ENDPOINT - Get TV show episodes list
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  pattern: "cineepisodes",
  alias: ["episodes", "cepisodes"],
  desc: "Get TV show episodes list",
  category: "downloader",
  react: "📺",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) {
      return reply(`❗ *Please provide a TV show URL*

*Usage:* .cineepisodes <url>
*Example:* .cineepisodes https://cinesubz.co/tvshows/the-witcher-2019/`);
    }

    // Clean the input
    let cleanUrl = q.trim();
    cleanUrl = cleanUrl.replace(/^(cineepisodes|episodes|cepisodes)\s+/i, '');

    if (!cleanUrl.includes('cinesubz.lk') && !cleanUrl.includes('cinesubz.co')) {
      return reply("❌ Please provide a valid CineSubz URL");
    }

    reply("📺 *Fetching episodes...*");

    // Call /episodes endpoint
    const episodesUrl = `${API_BASE}/episodes?url=${encodeURIComponent(cleanUrl)}`;
    const { data } = await axios.get(episodesUrl);

    if (!data.seasons || data.seasons.length === 0) {
      return reply("❌ No episodes found for this show.");
    }

    // Format episodes
    let message = `📺 *TV Show Episodes*\n\n`;
    message += `🎬 *Total Seasons:* ${data.seasons.length}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    data.seasons.forEach((season) => {
      message += `📁 *${season.season}*\n`;
      message += `📊 Episodes: ${season.episodes.length}\n\n`;

      season.episodes.slice(0, 20).forEach((episode, index) => {
        message += `  ${index + 1}. ${episode.title}\n`;
        message += `     🔗 ${episode.url}\n\n`;
      });

      if (season.episodes.length > 20) {
        message += `  ... and ${season.episodes.length - 20} more\n\n`;
      }

      message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    });

    message += `📌 *To get episode details:*\n`;
    message += `.cinedetails <episode_url>`;

    await conn.sendMessage(from, { text: message }, { quoted: mek });

  } catch (e) {
    console.error("Episodes error:", e);
    reply(`❌ *Error:* ${e.message}`);
  }
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4️⃣ DOWNLOAD ENDPOINT - Resolve countdown page & send file
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  pattern: "cinedownload",
  alias: ["cinedl", "cdl"],
  desc: "Download movie/episode from countdown page",
  category: "downloader",
  react: "📥",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) {
      return reply(`❗ *Please provide a countdown page URL*

*Usage:* .cinedownload <countdown_url>
*Example:* .cinedownload https://cinesubz.co/api-.../odcemnd9hb/`);
    }

    // Clean the input
    let cleanUrl = q.trim();
    cleanUrl = cleanUrl.replace(/^(cinedownload|cinedl|cdl)\s+/i, '');

    if (!cleanUrl.includes('cinesubz.lk') && !cleanUrl.includes('cinesubz.co')) {
      return reply("❌ Please provide a valid CineSubz countdown URL");
    }

    reply("⏳ *Resolving download link...*");

    // Call /download endpoint
    const downloadUrl = `${API_BASE}/download?url=${encodeURIComponent(cleanUrl)}`;
    const { data } = await axios.get(downloadUrl);

    // Check for success and download_url
    if (!data.success || !data.download_url) {
      console.error("Download API Error:", data);
      return reply(`❌ Failed to get download link.

*Error:* ${data.error || 'Unknown error'}

The countdown page might be invalid or expired.`);
    }

    const finalUrl = data.download_url;

    await conn.sendMessage(from, {
      text: `✅ *Download Link Resolved!*\n\n🔗 ${finalUrl}\n\n_Sending file... This may take a moment._`
    }, { quoted: mek });

    // Send as document
    await conn.sendMessage(from, {
      document: { url: finalUrl },
      mimetype: "video/mp4",
      fileName: `cinesubz_${Date.now()}.mp4`,
      caption: `✅ *Downloaded by Mr Senal*\n🔗 Powered by CineSubz API`
    }, { quoted: mek });

    reply("✅ *Download complete!*");

  } catch (e) {
    console.error("Download error:", e);
    reply(`❌ *Download failed:* ${e.message}\n\n_The link might be expired. Try getting a fresh link from .cinedetails_`);
  }
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📖 HELP COMMAND - Show all CineSubz commands
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cmd({
  pattern: "cinehelp",
  alias: ["moviehelp"],
  desc: "Show CineSubz downloader commands",
  category: "downloader",
  react: "ℹ️",
  filename: __filename
},
async (conn, mek, m, { from, reply }) => {
  const helpText = `📚 *CineSubz Downloader Commands*

━━━━━━━━━━━━━━━━━━━━━━

1️⃣ *Search Movies/Shows*
   .cinesearch <name>
   Example: .cinesearch Avatar

2️⃣ *Get Details & Links*
   .cinedetails <url>
   Example: .cinedetails https://cinesubz.co/movies/avatar/

3️⃣ *Get TV Show Episodes*
   .cineepisodes <show_url>
   Example: .cineepisodes https://cinesubz.co/tvshows/witcher/

4️⃣ *Download Movie/Episode*
   .cinedownload <countdown_url>
   Example: .cinedownload https://cinesubz.co/api-.../abc123/

━━━━━━━━━━━━━━━━━━━━━━

🎯 *WORKFLOW:*

For Movies:
.cinesearch → .cinedetails → .cinedownload

For TV Shows:
.cinesearch → .cinedetails → .cineepisodes → .cinedetails (episode) → .cinedownload

━━━━━━━━━━━━━━━━━━━━━━

💡 *Tips:*
• Copy URLs carefully (include full link)
• Countdown links expire quickly
• For TV shows, get episodes first
• Large files sent as documents

👨‍💻 Developed by Mr Senal
🔗 Powered by CineSubz API`;

  reply(helpText);
});
