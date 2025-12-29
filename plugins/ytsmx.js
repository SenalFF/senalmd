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

    // Format results
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

    await conn.sendMessage(from, { text: message }, { quoted: mek });

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

*Usage:* .cds <url>
*Example:* .cds https://cinesubz.lk/movies/avatar-2009/`);
    }

    // Validate URL - accept both .lk and .co domains
    if (!q.includes('cinesubz.lk') && !q.includes('cinesubz.co')) {
      return reply("❌ Please provide a valid CineSubz URL (cinesubz.lk or cinesubz.co)");
    }

    reply("⏳ *Fetching details...*");

    // Call /details endpoint
    const detailsUrl = `${API_BASE}/details?url=${encodeURIComponent(q)}`;
    const { data } = await axios.get(detailsUrl);

    if (!data || !data.title) {
      return reply("❌ Failed to fetch details. Please try again.");
    }

    // Format details
    let message = `🎬 *${data.title}*\n\n`;
    
    if (data.year) message += `📅 *Year:* ${data.year}\n`;
    if (data.genre) message += `🎭 *Genre:* ${data.genre}\n`;
    if (data.imdb) message += `⭐ *IMDB:* ${data.imdb}\n`;
    if (data.duration) message += `⏱️ *Duration:* ${data.duration}\n`;
    if (data.language) message += `🗣️ *Language:* ${data.language}\n`;
    if (data.type) message += `📁 *Type:* ${data.type}\n`;
    
    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    if (data.description) {
      const desc = data.description.length > 300 
        ? data.description.substring(0, 300) + '...' 
        : data.description;
      message += `📝 *Description:*\n${desc}\n\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // If it's a TV show
    if (data.type === "tvshow") {
      message += `📺 *This is a TV Show*\n\n`;
      message += `📌 *Get Episodes:*\n`;
      message += `.cineepisodes ${q}`;
    } 
    // If it's a movie
    else if (data.downloadLinks && Object.keys(data.downloadLinks).length > 0) {
      message += `📥 *Available Download Qualities:*\n\n`;
      
      Object.entries(data.downloadLinks).forEach(([quality, url]) => {
        message += `*${quality}*\n`;
        message += `🔗 ${url}\n\n`;
      });

      message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `📌 *To Download:*\n`;
      message += `.cinedownload <countdown_url>`;
    } else {
      message += `❌ No download links available`;
    }

    // Send with image if available
    if (data.image) {
      await conn.sendMessage(from, {
        image: { url: data.image },
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

    if (!q.includes('cinesubz.co')) {
      return reply("❌ Please provide a valid CineSubz URL");
    }

    reply("📺 *Fetching episodes...*");

    // Call /episodes endpoint
    const episodesUrl = `${API_BASE}/episodes?url=${encodeURIComponent(q)}`;
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

    if (!q.includes('cinesubz.co')) {
      return reply("❌ Please provide a valid CineSubz countdown URL");
    }

    reply("⏳ *Resolving download link...*");

    // Call /download endpoint
    const downloadUrl = `${API_BASE}/download?url=${encodeURIComponent(q)}`;
    const { data } = await axios.get(downloadUrl);

    if (!data.downloadUrl) {
      return reply("❌ Failed to get download link. The countdown page might be invalid.");
    }

    await conn.sendMessage(from, {
      text: `✅ *Download Link Ready!*\n\n🔗 ${data.downloadUrl}\n\n_Sending file now..._`
    }, { quoted: mek });

    // Send as document
    await conn.sendMessage(from, {
      document: { url: data.downloadUrl },
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
  const helpText = `
📚 *CineSubz Downloader Commands*

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
🔗 Powered by CineSubz API
`;

  reply(helpText);
});
