const { cmd } = require('../command');
const axios = require('axios');

const API_BASE = "https://your-cinesubz-api.vercel.app"; // Replace with your API URL

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

    // Show first 5 results with buttons
    const results = data.results.slice(0, 5);
    const buttons = results.map((item, index) => ({
      buttonId: `movie_select_${index}_${Buffer.from(item.url).toString('base64')}`,
      buttonText: { displayText: `${index + 1}. ${item.title}` },
      type: 1
    }));

    let caption = `🎬 *CineSubz Search Results*\n\n`;
    caption += `🔎 Query: *${q}*\n`;
    caption += `📊 Found: ${results.length} results\n\n`;
    
    results.forEach((item, i) => {
      caption += `*${i + 1}.* ${item.title}\n`;
      caption += `   📁 Type: ${item.type || 'N/A'}\n`;
      caption += `   🎭 Genre: ${item.genre || 'N/A'}\n\n`;
    });

    caption += `👇 *Select a movie/show below:*`;

    await conn.sendMessage(from, {
      text: caption,
      footer: "🔗 Powered by CineSubz API",
      buttons,
      headerType: 1
    }, { quoted: mek });

  } catch (e) {
    console.error("Error in movie search:", e);
    reply(`❌ Error: ${e.message}`);
  }
});


// 📺 BUTTON HANDLER - Movie/Show Selected
cmd({
  buttonHandler: async (conn, mek, btnId) => {
    const remoteJid = mek.key.remoteJid;

    try {
      // Handle movie selection
      if (btnId.startsWith("movie_select_")) {
        const parts = btnId.split("_");
        const encodedUrl = parts[parts.length - 1];
        const movieUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');

        await conn.sendMessage(remoteJid, {
          text: "⏳ *Fetching details... Please wait!*"
        }, { quoted: mek });

        // Get movie/show details
        const detailsUrl = `${API_BASE}/details?url=${encodeURIComponent(movieUrl)}`;
        const { data } = await axios.get(detailsUrl);

        if (data.type === "movie") {
          // MOVIE - Show download quality options
          await handleMovieDetails(conn, mek, remoteJid, data);
        } else if (data.type === "tvshow") {
          // TV SHOW - Show episodes list
          await handleTVShowDetails(conn, mek, remoteJid, data, movieUrl);
        }
      }

      // Handle episode selection
      if (btnId.startsWith("episode_select_")) {
        const parts = btnId.split("_");
        const encodedUrl = parts[parts.length - 1];
        const episodeUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');

        await conn.sendMessage(remoteJid, {
          text: "⏳ *Fetching episode details...*"
        }, { quoted: mek });

        const detailsUrl = `${API_BASE}/details?url=${encodeURIComponent(episodeUrl)}`;
        const { data } = await axios.get(detailsUrl);

        await handleMovieDetails(conn, mek, remoteJid, data); // Episodes use same download format
      }

      // Handle download quality selection
      if (btnId.startsWith("download_")) {
        const parts = btnId.split("_");
        const quality = parts[1];
        const encodedUrl = parts[parts.length - 1];
        const downloadPageUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');

        await handleDownload(conn, mek, remoteJid, downloadPageUrl, quality);
      }

    } catch (err) {
      console.error("Button handler error:", err);
      await conn.sendMessage(remoteJid, {
        text: `❌ Error: ${err.message}`
      }, { quoted: mek });
    }
  }
});


// 🎥 Handle Movie Details & Download Options
async function handleMovieDetails(conn, mek, remoteJid, data) {
  const buttons = [];

  // Create buttons for each quality option
  if (data.downloadLinks) {
    Object.entries(data.downloadLinks).forEach(([quality, url]) => {
      buttons.push({
        buttonId: `download_${quality}_${Buffer.from(url).toString('base64')}`,
        buttonText: { displayText: `📥 ${quality}` },
        type: 1
      });
    });
  }

  let caption = `🎬 *${data.title}*\n\n`;
  if (data.year) caption += `📅 Year: ${data.year}\n`;
  if (data.genre) caption += `🎭 Genre: ${data.genre}\n`;
  if (data.imdb) caption += `⭐ IMDB: ${data.imdb}\n`;
  if (data.duration) caption += `⏱️ Duration: ${data.duration}\n`;
  if (data.language) caption += `🗣️ Language: ${data.language}\n`;
  if (data.description) caption += `\n📝 ${data.description}\n`;
  caption += `\n👇 *Select quality to download:*`;

  await conn.sendMessage(remoteJid, {
    image: data.image ? { url: data.image } : undefined,
    caption,
    footer: "🔗 Powered by CineSubz",
    buttons,
    headerType: 4
  }, { quoted: mek });
}


// 📺 Handle TV Show Episodes List
async function handleTVShowDetails(conn, mek, remoteJid, data, showUrl) {
  await conn.sendMessage(remoteJid, {
    text: "📺 *Fetching episodes...*"
  }, { quoted: mek });

  const episodesUrl = `${API_BASE}/episodes?url=${encodeURIComponent(showUrl)}`;
  const { data: episodeData } = await axios.get(episodesUrl);

  if (!episodeData.seasons || episodeData.seasons.length === 0) {
    return conn.sendMessage(remoteJid, {
      text: "❌ No episodes found."
    }, { quoted: mek });
  }

  // Show first season's episodes (can be expanded to select seasons)
  const firstSeason = episodeData.seasons[0];
  const episodes = firstSeason.episodes.slice(0, 10); // Show first 10 episodes

  const buttons = episodes.map((ep, index) => ({
    buttonId: `episode_select_${index}_${Buffer.from(ep.url).toString('base64')}`,
    buttonText: { displayText: `${ep.title}` },
    type: 1
  }));

  let caption = `📺 *${data.title}*\n`;
  caption += `🎬 ${firstSeason.season}\n\n`;
  caption += `*Episodes:*\n\n`;
  
  episodes.forEach((ep, i) => {
    caption += `*${i + 1}.* ${ep.title}\n`;
  });

  caption += `\n👇 *Select an episode:*`;

  await conn.sendMessage(remoteJid, {
    image: data.image ? { url: data.image } : undefined,
    caption,
    footer: "🔗 Powered by CineSubz",
    buttons,
    headerType: 4
  }, { quoted: mek });
}


// 📥 Handle Download
async function handleDownload(conn, mek, remoteJid, countdownPageUrl, quality) {
  try {
    await conn.sendMessage(remoteJid, {
      text: `⏳ *Preparing ${quality} download...*`
    }, { quoted: mek });

    // Resolve countdown page to final download link
    const downloadUrl = `${API_BASE}/download?url=${encodeURIComponent(countdownPageUrl)}`;
    const { data } = await axios.get(downloadUrl);

    if (!data.downloadUrl) {
      return conn.sendMessage(remoteJid, {
        text: "❌ Failed to get download link."
      }, { quoted: mek });
    }

    await conn.sendMessage(remoteJid, {
      text: `✅ *Download link ready!*\n\n📥 Quality: *${quality}*\n🔗 Link: ${data.downloadUrl}\n\n_Sending file..._`
    }, { quoted: mek });

    // Send as document
    await conn.sendMessage(remoteJid, {
      document: { url: data.downloadUrl },
      mimetype: "video/mp4",
      fileName: `${quality}_cinesubz.mp4`,
      caption: `✅ *Downloaded by Mr Senal*\n📥 Quality: ${quality}`
    }, { quoted: mek });

  } catch (err) {
    console.error("Download error:", err);
    await conn.sendMessage(remoteJid, {
      text: `❌ Download failed: ${err.message}`
    }, { quoted: mek });
  }
}
