const { cmd } = require("../command");
const axios = require("axios");

// ✅ Global caches
global.searchCache = {};
global.downloadCache = {};
global.episodeCache = {};
global.movieStep = {}; // track current step per chat

// Helper for size fallback
const formatSize = (s) => s || "Unknown size";

/////////////////////////
// 🔍 SEARCH COMMAND
/////////////////////////
cmd({
  pattern: "movie",
  react: "🎬",
  category: "downloader",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

  if (!q) return reply("❗ Example: .movie avatar");

  reply("🔍 Searching...");

  try {
    const res = await axios.get(
      `https://mapi-beta.vercel.app/search?q=${encodeURIComponent(q)}`
    );

    const movies = [];
    const tvs = [];

    res.data.results.forEach(v => {
      if (v.type === "movie") movies.push(v);
      else tvs.push(v);
    });

    if (!movies.length && !tvs.length) return reply("❌ No results found");

    // store in cache
    searchCache[from] = { movies, tvs };
    movieStep[from] = "SELECT_ITEM";

    let text = "🎬 *Movies*\n";
    movies.forEach((v, i) => text += `m${i + 1} ${v.title}\n`);

    text += "\n📺 *TV Series*\n";
    tvs.forEach((v, i) => text += `tv${i + 1} ${v.title}\n`);

    text += "\n_Reply with m1 / tv1 to select_";

    reply(text);

  } catch (e) {
    console.error(e);
    reply("❌ Search failed");
  }
});

/////////////////////////
// 🔘 NUMBER REPLY HANDLER
/////////////////////////
cmd({
  on: "text",
  async: async (conn, mek, m, { from, body, reply }) => {

    if (!movieStep[from]) return;

    // MOVIE SELECT
    if (/^m\d+$/i.test(body) && movieStep[from] === "SELECT_ITEM") {
      const index = parseInt(body.slice(1)) - 1;
      const movie = searchCache[from]?.movies[index];
      if (!movie) return reply("❌ Invalid movie");

      try {
        const res = await axios.get(
          `https://mapi-beta.vercel.app/details?url=${encodeURIComponent(movie.url)}`
        );

        const data = res.data;
        downloadCache[from] = data.downloads;
        movieStep[from] = "SELECT_QUALITY";

        const buttons = data.downloads.map((d, i) => ({
          buttonId: `movdl_${i}`,
          buttonText: { displayText: `${d.quality} • ${formatSize(d.size)}` },
          type: 1
        }));

        let qualityText = "";
        data.downloads.forEach(d => qualityText += `• ${d.quality} — ${formatSize(d.size)}\n`);

        return conn.sendMessage(from, {
          image: { url: data.poster },
          caption:
            `🎬 *${data.title}*\n` +
            `📅 Release: ${data.release || "N/A"}\n` +
            `⭐ IMDb: ${data.imdb || "N/A"}\n\n` +
            `⬇️ *Available Qualities*\n${qualityText}` +
            `\nTap a quality button below 👇`,
          footer: "CineSubz • Mr Senal",
          buttons,
          headerType: 4
        }, { quoted: mek });

      } catch (e) {
        console.error(e);
        reply("❌ Failed to fetch movie details");
      }
    }

    // TV SELECT
    if (/^tv\d+$/i.test(body) && movieStep[from] === "SELECT_ITEM") {
      const index = parseInt(body.slice(2)) - 1;
      const tv = searchCache[from]?.tvs[index];
      if (!tv) return reply("❌ Invalid TV series");

      try {
        const res = await axios.get(
          `https://mapi-beta.vercel.app/episodes?url=${encodeURIComponent(tv.url)}`
        );

        const episodes = res.data.episodes;
        if (!episodes || !episodes.length) return reply("❌ No episodes found");

        episodeCache[from] = episodes;
        movieStep[from] = "SELECT_EPISODE";

        let text = `📺 *${tv.title}* — Episodes:\n`;
        episodes.forEach((e, i) => text += `ep${i + 1} ${e.title}\n`);

        text += "\n_Reply with ep1 / ep2 to select episode_";

        return reply(text);

      } catch (e) {
        console.error(e);
        reply("❌ Failed to fetch TV episodes");
      }
    }

    // EPISODE SELECT
    if (/^ep\d+$/i.test(body) && movieStep[from] === "SELECT_EPISODE") {
      const index = parseInt(body.slice(2)) - 1;
      const ep = episodeCache[from]?.[index];
      if (!ep) return reply("❌ Invalid episode");

      try {
        const res = await axios.get(
          `https://mapi-beta.vercel.app/details?url=${encodeURIComponent(ep.url)}`
        );

        const data = res.data;
        downloadCache[from] = data.downloads;
        movieStep[from] = "SELECT_QUALITY_EP";

        const buttons = data.downloads.map((d, i) => ({
          buttonId: `epdl_${i}`,
          buttonText: { displayText: `${d.quality} • ${formatSize(d.size)}` },
          type: 1
        }));

        let qText = "";
        data.downloads.forEach(d => qText += `• ${d.quality} — ${formatSize(d.size)}\n`);

        return conn.sendMessage(from, {
          image: { url: data.poster },
          caption:
            `🎞 *${data.title}*\n\n⬇️ *Available Qualities*\n${qText}` +
            `\nTap a quality button below 👇`,
          footer: "CineSubz • Mr Senal",
          buttons,
          headerType: 4
        }, { quoted: mek });

      } catch (e) {
        console.error(e);
        reply("❌ Failed to fetch episode details");
      }
    }
  }
});

/////////////////////////
// ⬇️ DOWNLOAD BUTTON HANDLER
/////////////////////////
cmd({
  buttonHandler: async (conn, mek, btnId) => {
    const from = mek.key.remoteJid;

    if (!btnId.startsWith("movdl_") && !btnId.startsWith("epdl_")) return;

    const index = parseInt(btnId.split("_")[1]);
    const item = downloadCache[from]?.[index];
    if (!item) return;

    try {
      const res = await axios.get(
        `https://mapi-beta.vercel.app/download?url=${encodeURIComponent(item.url)}`
      );

      movieStep[from] = null;
      downloadCache[from] = null;

      return conn.sendMessage(from, {
        document: { url: res.data.download },
        mimetype: "video/mp4",
        fileName: "video.mp4",
        caption: "✅ Download started"
      }, { quoted: mek });

    } catch (e) {
      console.error(e);
      return conn.sendMessage(from, { text: "❌ Failed to start download" }, { quoted: mek });
    }
  }
});
       
