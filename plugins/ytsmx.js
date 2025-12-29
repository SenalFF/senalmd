const { cmd } = require('../command');
const axios = require('axios');

const API_BASE = "https://your-cinesubz-api.vercel.app"; // Replace with your API URL

// Store user sessions (search results, selections)
const userSessions = new Map();

// 🎬 SEARCH COMMAND
cmd({
  pattern: "movie",
  alias: ["film", "series", "tv"],
  desc: "Search and download movies/TV shows from CineSubz",
  category: "downloader",
  react: "🎬",
  filename: __filename
},
async (conn, mek, m, { from, args, q, reply }) => {
  try {
    if (!q) return reply("❗ Please provide a movie or TV show name.\n\n*Example:* `.movie Avatar`");

    reply("🔍 *Searching CineSubz... Please wait!*");

    // Search API call
    const searchUrl = `${API_BASE}/search?q=${encodeURIComponent(q)}`;
    const { data } = await axios.get(searchUrl);

    if (!data.results || data.results.length === 0) {
      return reply("❌ No results found for your search.");
    }

    // Show first 6 results
    const results = data.results.slice(0, 6);
    
    // Store in session
    userSessions.set(from, {
      type: 'search_results',
      results: results,
      timestamp: Date.now()
    });

    let caption = `🎬 *CineSubz Search Results*\n\n`;
    caption += `🔎 Query: *${q}*\n`;
    caption += `📊 Found: ${results.length} results\n\n`;
    
    results.forEach((item, i) => {
      caption += `*${i + 1}.* ${item.title}\n`;
      if (item.type) caption += `   📁 ${item.type}\n`;
      if (item.genre) caption += `   🎭 ${item.genre}\n`;
      if (item.year) caption += `   📅 ${item.year}\n`;
      caption += `\n`;
    });

    caption += `💬 *Reply with number (1-${results.length}) to select*`;

    await conn.sendMessage(from, {
      text: caption
    }, { quoted: mek });

  } catch (e) {
    console.error("Error in movie search:", e);
    reply(`❌ Error: ${e.message}`);
  }
});


// 📱 NUMBER SELECTION HANDLER
cmd({
  on: "text"
},
async (conn, mek, m, { from, body, reply }) => {
  try {
    const session = userSessions.get(from);
    if (!session) return;

    // Check if session is expired (5 minutes)
    if (Date.now() - session.timestamp > 300000) {
      userSessions.delete(from);
      return;
    }

    const input = body.trim();

    // Handle search results selection
    if (session.type === 'search_results' && /^\d+$/.test(input)) {
      const index = parseInt(input) - 1;
      
      if (index < 0 || index >= session.results.length) {
        return reply(`❌ Invalid selection. Please reply with a number between 1-${session.results.length}`);
      }

      const selected = session.results[index];
      await reply("⏳ *Fetching details... Please wait!*");

      // Get movie/show details
      const detailsUrl = `${API_BASE}/details?url=${encodeURIComponent(selected.url)}`;
      const { data } = await axios.get(detailsUrl);

      if (data.type === "movie") {
        await showMovieDetails(conn, mek, from, data, selected.url);
      } else if (data.type === "tvshow") {
        await showTVShowEpisodes(conn, mek, from, data, selected.url);
      }
    }

    // Handle quality selection for movies
    if (session.type === 'movie_qualities' && /^\d+$/.test(input)) {
      const index = parseInt(input) - 1;
      
      if (index < 0 || index >= session.qualities.length) {
        return reply(`❌ Invalid selection. Please reply 1-${session.qualities.length}`);
      }

      const selected = session.qualities[index];
      await handleDownload(conn, mek, from, selected.url, selected.quality);
    }

    // Handle episode selection for TV shows
    if (session.type === 'tv_episodes' && /^\d+$/.test(input)) {
      const index = parseInt(input) - 1;
      
      if (index < 0 || index >= session.episodes.length) {
        return reply(`❌ Invalid selection. Please reply 1-${session.episodes.length}`);
      }

      const selected = session.episodes[index];
      await reply("⏳ *Fetching episode details...*");

      const detailsUrl = `${API_BASE}/details?url=${encodeURIComponent(selected.url)}`;
      const { data } = await axios.get(detailsUrl);

      await showMovieDetails(conn, mek, from, data, selected.url);
    }

  } catch (err) {
    console.error("Selection handler error:", err);
    reply(`❌ Error: ${err.message}`);
  }
});


// 🎥 Show Movie Details & Quality Options
async function showMovieDetails(conn, mek, from, data, sourceUrl) {
  try {
    const qualities = [];

    if (data.downloadLinks) {
      Object.entries(data.downloadLinks).forEach(([quality, url]) => {
        qualities.push({ quality, url });
      });
    }

    // Store in session
    userSessions.set(from, {
      type: 'movie_qualities',
      qualities: qualities,
      movieData: data,
      timestamp: Date.now()
    });

    let caption = `🎬 *${data.title}*\n\n`;
    if (data.year) caption += `📅 Year: ${data.year}\n`;
    if (data.genre) caption += `🎭 Genre: ${data.genre}\n`;
    if (data.imdb) caption += `⭐ IMDB: ${data.imdb}\n`;
    if (data.duration) caption += `⏱️ Duration: ${data.duration}\n`;
    if (data.language) caption += `🗣️ Language: ${data.language}\n`;
    
    if (data.description) {
      const shortDesc = data.description.length > 200 
        ? data.description.substring(0, 200) + '...' 
        : data.description;
      caption += `\n📝 ${shortDesc}\n`;
    }
    
    caption += `\n📥 *Available Qualities:*\n\n`;
    qualities.forEach((q, i) => {
      caption += `*${i + 1}.* ${q.quality}\n`;
    });
    
    caption += `\n💬 *Reply with number to download*`;

    if (data.image) {
      await conn.sendMessage(from, {
        image: { url: data.image },
        caption
      }, { quoted: mek });
    } else {
      await conn.sendMessage(from, { text: caption }, { quoted: mek });
    }

  } catch (err) {
    console.error("Error showing movie details:", err);
    throw err;
  }
}


// 📺 Show TV Show Episodes
async function showTVShowEpisodes(conn, mek, from, data, showUrl) {
  try {
    await conn.sendMessage(from, {
      text: "📺 *Fetching episodes...*"
    }, { quoted: mek });

    const episodesUrl = `${API_BASE}/episodes?url=${encodeURIComponent(showUrl)}`;
    const { data: episodeData } = await axios.get(episodesUrl);

    if (!episodeData.seasons || episodeData.seasons.length === 0) {
      return conn.sendMessage(from, {
        text: "❌ No episodes found."
      }, { quoted: mek });
    }

    // Show first season's episodes
    const firstSeason = episodeData.seasons[0];
    const episodes = firstSeason.episodes.slice(0, 15); // Show first 15 episodes

    // Store in session
    userSessions.set(from, {
      type: 'tv_episodes',
      episodes: episodes,
      showData: data,
      timestamp: Date.now()
    });

    let caption = `📺 *${data.title}*\n`;
    caption += `🎬 ${firstSeason.season}\n\n`;
    caption += `*Episodes:*\n\n`;
    
    episodes.forEach((ep, i) => {
      caption += `*${i + 1}.* ${ep.title}\n`;
    });

    caption += `\n💬 *Reply with episode number*`;

    if (data.image) {
      await conn.sendMessage(from, {
        image: { url: data.image },
        caption
      }, { quoted: mek });
    } else {
      await conn.sendMessage(from, { text: caption }, { quoted: mek });
    }

  } catch (err) {
    console.error("Error showing episodes:", err);
    throw err;
  }
}


// 📥 Handle Download
async function handleDownload(conn, mek, from, countdownPageUrl, quality) {
  try {
    // Clear session
    userSessions.delete(from);

    await conn.sendMessage(from, {
      text: `⏳ *Preparing ${quality} download...*`
    }, { quoted: mek });

    // Resolve countdown page to final download link
    const downloadUrl = `${API_BASE}/download?url=${encodeURIComponent(countdownPageUrl)}`;
    const { data } = await axios.get(downloadUrl);

    if (!data.downloadUrl) {
      return conn.sendMessage(from, {
        text: "❌ Failed to get download link. Try again later."
      }, { quoted: mek });
    }

    await conn.sendMessage(from, {
      text: `✅ *Download Ready!*\n\n📥 Quality: *${quality}*\n\n_Sending file... This may take a moment._`
    }, { quoted: mek });

    // Send as document
    await conn.sendMessage(from, {
      document: { url: data.downloadUrl },
      mimetype: "video/mp4",
      fileName: `${quality}_cinesubz_${Date.now()}.mp4`,
      caption: `✅ *Downloaded by Mr Senal*\n📥 Quality: ${quality}\n🔗 Powered by CineSubz API`
    }, { quoted: mek });

  } catch (err) {
    console.error("Download error:", err);
    await conn.sendMessage(from, {
      text: `❌ Download failed: ${err.message}\n\nTry searching again with .movie command`
    }, { quoted: mek });
  }
}


// 🧹 Clean old sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of userSessions.entries()) {
    if (now - session.timestamp > 600000) { // 10 minutes
      userSessions.delete(key);
    }
  }
}, 600000);
