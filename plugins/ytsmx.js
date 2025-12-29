const { cmd } = require('../command');
const axios = require('axios');

/* =========================
   🎬 MOVIE SEARCH
========================= */
cmd({
  pattern: "movie",
  desc: "Movie downloader",
  category: "downloader",
  react: "🎬",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

  if (!q) return reply("❗ Example: .movie avatar");

  reply("🔍 Searching...");

  try {
    const res = await axios.get(
      `https://mapi-beta.vercel.app/search?q=${encodeURIComponent(q)}`
    );

    if (!res.data || !res.data.results || !res.data.results.length) {
      return reply("❌ No results found");
    }

    // only 3 buttons (safe)
    const results = res.data.results.slice(0, 3);

    // save per chat
    global.movieCache = global.movieCache || {};
    global.movieCache[from] = results;

    const buttons = results.map((v, i) => ({
      buttonId: `movie_${i}`,
      buttonText: { displayText: `${v.type === "tv" ? "📺" : "🎬"} ${v.title}` },
      type: 1
    }));

    await conn.sendMessage(from, {
      text: "🎬 Select a movie / TV series",
      buttons,
      footer: "CineSubz • Mr Senal",
      headerType: 1
    }, { quoted: mek });

  } catch (e) {
    console.error(e);
    reply("❌ Search failed");
  }
});

/* =========================
   🔘 BUTTON HANDLER
========================= */
cmd({
  buttonHandler: async (conn, mek, btnId) => {
    const from = mek.key.remoteJid;

    console.log("BTN:", btnId); // DEBUG (important)

    /* 🎬 MOVIE SELECT */
    if (btnId.startsWith("movie_")) {
      const index = btnId.split("_")[1];
      const item = global.movieCache?.[from]?.[index];
      if (!item) return;

      const res = await axios.get(
        `https://mapi-beta.vercel.app/details?url=${encodeURIComponent(item.url)}`
      );

      const data = res.data;

      const buttons = data.downloads.slice(0, 3).map(d => ({
        buttonId: `moviedl_${encodeURIComponent(d.url)}`,
        buttonText: { displayText: `⬇️ ${d.quality}` },
        type: 1
      }));

      return conn.sendMessage(from, {
        image: { url: data.poster },
        caption:
          `🎬 *${data.title}*\n` +
          `📅 ${data.release || "N/A"}\n` +
          `⭐ IMDb: ${data.imdb || "N/A"}\n` +
          `⏱️ ${data.duration || "N/A"}\n\n` +
          `Select quality 👇`,
        buttons,
        footer: "CineSubz",
        headerType: 4
      }, { quoted: mek });
    }

    /* ⬇️ DOWNLOAD */
    if (btnId.startsWith("moviedl_")) {
      const pageUrl = decodeURIComponent(btnId.replace("moviedl_", ""));

      await conn.sendMessage(from, {
        text: "⏳ Resolving download..."
      }, { quoted: mek });

      const res = await axios.get(
        `https://mapi-beta.vercel.app/download?url=${encodeURIComponent(pageUrl)}`
      );

      if (!res.data || !res.data.download) {
        return conn.sendMessage(from, { text: "❌ Download failed" }, { quoted: mek });
      }

      return conn.sendMessage(from, {
        document: { url: res.data.download },
        mimetype: "video/mp4",
        fileName: "movie.mp4",
        caption: "✅ Download started"
      }, { quoted: mek });
    }
  }
});
      
