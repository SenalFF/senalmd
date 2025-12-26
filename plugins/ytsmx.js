const { cmd } = require('../command');
const axios = require('axios');

const API = "https://mapi-beta.vercel.app";

// temp memory (safe for low users)
global.cineSearch = {};
global.cineEpisodes = {};

/* =========================
   🎬 SEARCH MOVIE / TV
========================= */
cmd({
  pattern: "movie",
  alias: ["mv", "film", "tv"],
  desc: "Search movies or TV series",
  category: "downloader",
  react: "🎬",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Enter movie or TV show name");

    reply("🔍 Searching...");

    const { data } = await axios.get(
      `${API}/search?q=${encodeURIComponent(q)}`
    );

    if (!data || data.length === 0) {
      return reply("❌ No results found");
    }

    const list = data.slice(0, 6);
    global.cineSearch[from] = list;

    let text = "🎬 *Search Results*\n\n";
    list.forEach((v, i) => {
      text += `${i + 1}. ${v.title}\n`;
    });
    text += `\nReply with a number (1-${list.length})`;

    await conn.sendMessage(from, { text }, { quoted: mek });

  } catch (e) {
    console.error(e);
    reply("❌ Search failed");
  }
});

/* =========================
   🎯 SELECT MOVIE / TV
========================= */
cmd({
  pattern: "^[1-9]$",
  dontAddCommandList: true
},
async (conn, mek, m, { from, reply }) => {
  try {
    if (!global.cineSearch[from]) return;

    const num = parseInt(m.text);
    const selected = global.cineSearch[from][num - 1];
    if (!selected) return;

    delete global.cineSearch[from];

    const { data } = await axios.get(
      `${API}/details?url=${encodeURIComponent(selected.url)}`
    );

    // TV SERIES → EPISODES
    if (data.type === "tv") {
      const epRes = await axios.get(
        `${API}/episodes?url=${encodeURIComponent(selected.url)}`
      );

      global.cineEpisodes[from] = epRes.data;

      let txt = `📺 *${data.title}*\n\n`;
      epRes.data.slice(0, 10).forEach((e, i) => {
        txt += `${i + 1}. ${e.title}\n`;
      });
      txt += `\nReply with episode number`;

      return conn.sendMessage(from, { text: txt }, { quoted: mek });
    }

    // MOVIE → DOWNLOAD QUALITIES
    const buttons = data.downloads.map(d => ({
      buttonId: `dl|${encodeURIComponent(d.url)}`,
      buttonText: { displayText: `⬇️ ${d.quality}` },
      type: 1
    }));

    const caption =
`🎬 *${data.title}*
📝 ${data.description || "No description"}

👇 Select quality`;

    await conn.sendMessage(from, {
      image: { url: data.poster },
      caption,
      footer: "CineSubz API • Mr Senal",
      buttons,
      headerType: 4
    }, { quoted: mek });

  } catch (e) {
    console.error(e);
    reply("❌ Failed to load details");
  }
});

/* =========================
   📺 EPISODE SELECT
========================= */
cmd({
  pattern: "^[0-9]+$",
  dontAddCommandList: true
},
async (conn, mek, m, { from }) => {
  try {
    if (!global.cineEpisodes[from]) return;

    const ep = global.cineEpisodes[from][parseInt(m.text) - 1];
    if (!ep) return;

    delete global.cineEpisodes[from];

    const { data } = await axios.get(
      `${API}/details?url=${encodeURIComponent(ep.url)}`
    );

    const buttons = data.downloads.map(d => ({
      buttonId: `dl|${encodeURIComponent(d.url)}`,
      buttonText: { displayText: `⬇️ ${d.quality}` },
      type: 1
    }));

    await conn.sendMessage(from, {
      image: { url: data.poster },
      caption: `📺 *${ep.title}*\n\n👇 Select quality`,
      footer: "CineSubz API",
      buttons,
      headerType: 4
    }, { quoted: mek });

  } catch (e) {
    console.error(e);
  }
});

/* =========================
   ⬇️ DOWNLOAD HANDLER
========================= */
cmd({
  on: "button"
},
async (conn, mek, m) => {
  try {
    const id = m.buttonId;
    const from = mek.key.remoteJid;

    if (!id.startsWith("dl|")) return;

    const countdownUrl = decodeURIComponent(id.split("|")[1]);

    await conn.sendMessage(from, {
      text: "⏳ Resolving download link..."
    }, { quoted: mek });

    const { data } = await axios.get(
      `${API}/download?url=${encodeURIComponent(countdownUrl)}`
    );

    if (!data.download) {
      return conn.sendMessage(from, { text: "❌ Download failed" });
    }

    await conn.sendMessage(from, {
      document: { url: data.download },
      mimetype: "video/mp4",
      fileName: "movie.mp4",
      caption: "✅ Download completed"
    }, { quoted: mek });

  } catch (e) {
    console.error(e);
  }
});
