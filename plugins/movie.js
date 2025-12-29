const { cmd } = require('../command');
const axios = require('axios');

const API = "https://mapi-beta.vercel.app";
const cineSession = {};

/* =========================
   🔍 SEARCH MOVIE / TV
========================= */
cmd({
  pattern: "movie",
  alias: ["mv", "tv"],
  react: "🎬",
  category: "downloader",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

  if (!q) return reply("❗ Example: .movie avatar");
  reply("🔍 Searching...");

  try {
    const { data } = await axios.get(
      `${API}/search?q=${encodeURIComponent(q)}`,
      { timeout: 15000 }
    );

    if (!data?.results?.length) {
      return reply("❌ No results found");
    }

    const rows = data.results.slice(0, 10).map(v => ({
      title: v.title,
      description: v.type === "tv" ? "📺 TV Series" : "🎬 Movie",
      rowId: `cine_select|${encodeURIComponent(v.url)}`
    }));

    await conn.sendMessage(from, {
      text: "🎬 *Search Results*",
      footer: "CineSubz • Mr Senal",
      title: "Select Movie / TV",
      buttonText: "📂 Open List",
      sections: [{ title: "Results", rows }]
    }, { quoted: mek });

  } catch (e) {
    console.error("SEARCH ERROR:", e);
    reply("❌ Search failed");
  }
});

/* =========================
   📂 HANDLE LIST SELECTION
========================= */
cmd({ on: "message" }, async (conn, mek, m) => {
  try {
    const from = mek.key.remoteJid;

    const listMsg = m.message?.listResponseMessage;
    if (!listMsg) return;

    const id = listMsg.singleSelectReply.selectedRowId;
    if (!id) return;

    /* 🎬 MOVIE / TV SELECT */
    if (id.startsWith("cine_select|")) {
      const url = decodeURIComponent(id.split("|")[1]);

      const { data } = await axios.get(
        `${API}/details?url=${encodeURIComponent(url)}`
      );

      // MOVIE
      if (data.type !== "tv") {
        return sendDetails(conn, mek, from, data);
      }

      // TV SERIES
      const epRes = await axios.get(
        `${API}/episodes?url=${encodeURIComponent(url)}`
      );

      cineSession[from] = {
        episodes: epRes.data,
        title: data.title,
        poster: data.poster
      };

      const seasons = [...new Set(epRes.data.map(e => e.season || "Season 1"))];

      const rows = seasons.map(s => ({
        title: s,
        description: "Season",
        rowId: `cine_season|${s}`
      }));

      return conn.sendMessage(from, {
        image: { url: data.poster },
        caption: `📺 *${data.title}*\n\nSelect season`,
        footer: "CineSubz",
        title: "Seasons",
        buttonText: "📂 Season List",
        sections: [{ title: "Seasons", rows }]
      }, { quoted: mek });
    }

    /* 📺 SEASON SELECT */
    if (id.startsWith("cine_season|")) {
      const season = id.split("|")[1];
      const session = cineSession[from];
      if (!session) return;

      const eps = session.episodes.filter(
        e => (e.season || "Season 1") === season
      );

      const rows = eps.map(e => ({
        title: e.title,
        description: season,
        rowId: `cine_ep|${encodeURIComponent(e.url)}`
      }));

      return conn.sendMessage(from, {
        text: `📂 *${season}*\nSelect episode`,
        footer: "CineSubz",
        title: "Episodes",
        buttonText: "📂 Episode List",
        sections: [{ title: "Episodes", rows }]
      }, { quoted: mek });
    }

    /* 🎞 EPISODE SELECT */
    if (id.startsWith("cine_ep|")) {
      const epUrl = decodeURIComponent(id.split("|")[1]);
      delete cineSession[from];

      const { data } = await axios.get(
        `${API}/details?url=${encodeURIComponent(epUrl)}`
      );

      return sendDetails(conn, mek, from, data);
    }

  } catch (e) {
    console.error("LIST HANDLER ERROR:", e);
  }
});

/* =========================
   🎬 DETAILS + DOWNLOAD
========================= */
async function sendDetails(conn, mek, from, data) {
  let caption = `🎬 *${data.title}*\n`;
  if (data.release) caption += `📅 Release: ${data.release}\n`;
  if (data.imdb) caption += `⭐ IMDb: ${data.imdb}\n`;
  if (data.duration) caption += `⏱️ Duration: ${data.duration}\n`;
  if (data.genre) caption += `🎭 Genre: ${data.genre.join(", ")}\n`;
  if (data.description) caption += `\n📝 ${data.description}\n`;

  const buttons = data.downloads.map(d => ({
    buttonId: `cine_dl|${encodeURIComponent(d.url)}`,
    buttonText: { displayText: `⬇️ ${d.quality} • ${d.size || "?"}` },
    type: 1
  }));

  await conn.sendMessage(from, {
    image: { url: data.poster },
    caption: caption + "\n👇 Select quality",
    footer: "CineSubz • Mr Senal",
    buttons,
    headerType: 4
  }, { quoted: mek });
}

/* =========================
   ⬇️ DOWNLOAD HANDLER
========================= */
cmd({ on: "button" }, async (conn, mek, m) => {
  try {
    const from = mek.key.remoteJid;
    const id = m.buttonId;
    if (!id?.startsWith("cine_dl|")) return;

    const pageUrl = decodeURIComponent(id.split("|")[1]);
    await conn.sendMessage(from, { text: "⏳ Resolving download..." }, { quoted: mek });

    const { data } = await axios.get(
      `${API}/download?url=${encodeURIComponent(pageUrl)}`
    );

    if (!data?.download) {
      return conn.sendMessage(from, { text: "❌ Download failed" }, { quoted: mek });
    }

    await conn.sendMessage(from, {
      document: { url: data.download },
      mimetype: "video/mp4",
      fileName: "movie.mp4",
      caption: "✅ Download started"
    }, { quoted: mek });

  } catch (e) {
    console.error("DOWNLOAD ERROR:", e);
  }
});
                           
