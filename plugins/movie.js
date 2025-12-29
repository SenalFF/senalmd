const { cmd } = require('../command');
const axios = require('axios');

const API = "https://mapi-beta.vercel.app";
global.cineSession = {}; // store sessions per user

/* =========================
   🔍 SEARCH MOVIE / TV
========================= */
cmd({
  pattern: "movie",
  alias: ["mv", "tv"],
  category: "downloader",
  react: "🎬",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  if (!q) return reply("❗ Example: .movie avatar");
  reply("🔍 Searching...");

  try {
    const res = await axios.get(`${API}/search?q=${encodeURIComponent(q)}`, { timeout: 15000 });

    if (!res.data || !res.data.results || !res.data.results.length) {
      return reply("❌ No results found");
    }

    const results = res.data.results.slice(0, 10);

    const rows = results.map(v => ({
      title: v.title,
      description: v.type === "tv" ? "📺 TV Series" : "🎬 Movie",
      rowId: `cine_select|${encodeURIComponent(v.url)}`
    }));

    await conn.sendMessage(from, {
      text: "🎬 *Search Results*",
      footer: "Select one or Cancel",
      title: "CineSubz Downloader",
      buttonText: "📂 Open List",
      sections: [{ title: "Results", rows }]
    }, { quoted: mek });

  } catch (e) {
    console.error("SEARCH ERROR:", e.message);
    reply("❌ Search failed. Please try again.");
  }
});

/* =========================
   🎬 SELECT HANDLER (MOVIE / TV / SEASONS / EPISODES)
========================= */
cmd({ on: "list_response" }, async (conn, mek, m) => {
  try {
    const id =
      m.listResponse?.singleSelectReply?.selectedRowId ||
      m.message?.listResponseMessage?.singleSelectReply?.selectedRowId;
    if (!id) return;

    const from = mek.key.remoteJid;

    /* ❌ CANCEL */
    if (id === "cine_cancel") {
      delete cineSession[from];
      return conn.sendMessage(from, { text: "❌ Cancelled" }, { quoted: mek });
    }

    /* 🎬 MOVIE / TV SELECT */
    if (id.startsWith("cine_select|")) {
      const url = decodeURIComponent(id.split("|")[1]);
      const res = await axios.get(`${API}/details?url=${encodeURIComponent(url)}`);
      const data = res.data;

      // MOVIE
      if (data.type !== "tv") return sendDownloadUI(conn, mek, from, data);

      // TV SERIES → SHOW SEASONS
      cineSession[from] = { seriesUrl: url };
      const epRes = await axios.get(`${API}/episodes?url=${encodeURIComponent(url)}`);
      const seasons = [...new Set(epRes.data.map(e => e.season || "Season 1"))];

      const rows = seasons.map(s => ({
        title: s,
        description: "Season",
        rowId: `cine_season|${s}`
      }));

      await conn.sendMessage(from, {
        image: { url: data.poster },
        caption: `📺 *${data.title}*\n\nSelect season`,
        footer: "CineSubz",
        title: "Seasons",
        buttonText: "📂 Season List",
        sections: [{ title: "Seasons", rows }]
      }, { quoted: mek });

      cineSession[from].episodes = epRes.data;
    }

    /* SEASON SELECT */
    if (id.startsWith("cine_season|")) {
      const season = id.split("|")[1];
      const session = cineSession[from];
      if (!session) return;

      const eps = session.episodes.filter(e => (e.season || "Season 1") === season);

      const rows = eps.map(e => ({
        title: e.title,
        description: season,
        rowId: `cine_ep|${encodeURIComponent(e.url)}`
      }));

      await conn.sendMessage(from, {
        text: `📂 *${season}*\nSelect episode`,
        footer: "CineSubz",
        title: "Episodes",
        buttonText: "📂 Episode List",
        sections: [{ title: "Episodes", rows }]
      }, { quoted: mek });
    }

    /* EPISODE SELECT */
    if (id.startsWith("cine_ep|")) {
      const epUrl = decodeURIComponent(id.split("|")[1]);
      delete cineSession[from];

      const res = await axios.get(`${API}/details?url=${encodeURIComponent(epUrl)}`);
      return sendDownloadUI(conn, mek, from, res.data);
    }

  } catch (e) {
    console.error("SELECT ERROR:", e);
  }
});

/* =========================
   🎞 DOWNLOAD + SUBTITLE UI
========================= */
async function sendDownloadUI(conn, mek, from, data) {
  let textDetails = `🎬 *${data.title}*\n`;
  if (data.release) textDetails += `📅 Release: ${data.release}\n`;
  if (data.imdb) textDetails += `⭐ IMDb: ${data.imdb}\n`;
  if (data.duration) textDetails += `⏱️ Duration: ${data.duration}\n`;
  if (data.genre) textDetails += `🎭 Genre: ${data.genre.join(", ")}\n`;
  if (data.description) textDetails += `📝 ${data.description}\n\n`;

  const buttons = data.downloads.map(d => ({
    buttonId: `cine_dl|${encodeURIComponent(d.url)}`,
    buttonText: { displayText: `⬇️ ${d.quality} • ${d.size || "?"}` },
    type: 1
  }));

  // Subtitles
  if (data.subtitles?.length) {
    buttons.push({
      buttonId: `cine_subs|${encodeURIComponent(data.url)}`,
      buttonText: { displayText: "💬 Subtitles" },
      type: 1
    });
  }

  // Cancel button
  buttons.push({
    buttonId: "cine_cancel_btn",
    buttonText: { displayText: "❌ Cancel" },
    type: 1
  });

  await conn.sendMessage(from, {
    image: { url: data.poster },
    caption: textDetails + "👇 Select option",
    footer: "CineSubz • Mr Senal",
    buttons,
    headerType: 4
  }, { quoted: mek });
}

/* =========================
   ⬇️ BUTTON HANDLER
========================= */
cmd({ on: "button" }, async (conn, mek, m) => {
  try {
    const id = m.buttonId;
    const from = mek.key.remoteJid;

    /* ❌ CANCEL */
    if (id === "cine_cancel_btn") {
      delete cineSession[from];
      return conn.sendMessage(from, { text: "❌ Cancelled" }, { quoted: mek });
    }

    /* 💬 SUBTITLES */
    if (id.startsWith("cine_subs|")) {
      return conn.sendMessage(from, {
        text: "💬 Subtitle download per language (API ready)"
      }, { quoted: mek });
    }

    /* ⬇️ DOWNLOAD */
    if (!id.startsWith("cine_dl|")) return;
    const pageUrl = decodeURIComponent(id.split("|")[1]);

    await conn.sendMessage(from, { text: "⏳ Preparing download..." }, { quoted: mek });

    const res = await axios.get(`${API}/download?url=${encodeURIComponent(pageUrl)}`);
    if (!res.data?.download) {
      return conn.sendMessage(from, { text: "❌ Download failed" }, { quoted: mek });
    }

    await conn.sendMessage(from, {
      document: { url: res.data.download },
      mimetype: "video/mp4",
      fileName: "video.mp4",
      caption: "✅ Download started"
    }, { quoted: mek });

  } catch (e) {
    console.error("DOWNLOAD ERROR:", e);
  }
});
     
