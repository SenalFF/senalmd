const { cmd } = require('../command');
const axios = require('axios');

const API = "https://mapi-beta.vercel.app";

// user states
global.cineSearch = {};
global.cineEpisodes = {};

/* =========================
   🔍 SEARCH MOVIE / TV
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

    const res = await axios.get(
      `${API}/search?q=${encodeURIComponent(q)}`
    );

    if (!res.data?.results?.length) {
      return reply("❌ No results found");
    }

    const list = res.data.results.slice(0, 6);
    global.cineSearch[from] = list;

    let txt = "🎬 *Search Results*\n\n";
    list.forEach((v, i) => {
      txt += `${i + 1}. ${v.title}\n`;
    });
    txt += `\nReply with number (1-${list.length})`;

    await conn.sendMessage(from, { text: txt }, { quoted: mek });

  } catch (e) {
    console.error("SEARCH ERROR:", e.message);
    reply("❌ Search failed");
  }
});

/* =========================
   🔢 NUMBER HANDLER
========================= */
cmd({
  pattern: "^[0-9]+$",
  dontAddCommandList: true
},
async (conn, mek, m, { from, reply }) => {
  try {
    const num = parseInt(m.text);

    /* ---------- SELECT SEARCH RESULT ---------- */
    if (global.cineSearch[from]) {
      const list = global.cineSearch[from];
      const selected = list[num - 1];
      if (!selected) return reply("❌ Invalid number");

      delete global.cineSearch[from];

      const res = await axios.get(
        `${API}/details?url=${encodeURIComponent(selected.url)}`
      );
      const data = res.data;

      /* ===== TV SERIES ===== */
      if (data.type === "tv") {
        const epRes = await axios.get(
          `${API}/episodes?url=${encodeURIComponent(selected.url)}`
        );

        if (!epRes.data?.length) {
          return reply("❌ No episodes found");
        }

        global.cineEpisodes[from] = epRes.data;

        let txt =
`📺 *${data.title}*

📝 ${data.description || "No description"}

📂 Episodes:\n`;

        epRes.data.slice(0, 10).forEach((e, i) => {
          txt += `${i + 1}. ${e.title}\n`;
        });

        txt += `\nReply with episode number`;

        return conn.sendMessage(from, {
          image: { url: data.poster },
          caption: txt
        }, { quoted: mek });
      }

      /* ===== MOVIE ===== */
      const buttons = data.downloads.map(d => ({
        buttonId: `dl|${encodeURIComponent(d.url)}`,
        buttonText: {
          displayText: `⬇️ ${d.quality} • ${d.size || "?"}`
        },
        type: 1
      }));

      return conn.sendMessage(from, {
        image: { url: data.poster },
        caption:
`🎬 *${data.title}*
📅 ${data.year || "N/A"}
⏱️ ${data.duration || "N/A"}

📝 ${data.description || "No description"}

👇 Select quality`,
        footer: "CineSubz • Mr Senal",
        buttons,
        headerType: 4
      }, { quoted: mek });
    }

    /* ---------- SELECT EPISODE ---------- */
    if (global.cineEpisodes[from]) {
      const eps = global.cineEpisodes[from];
      const ep = eps[num - 1];
      if (!ep) return reply("❌ Invalid episode");

      delete global.cineEpisodes[from];

      const res = await axios.get(
        `${API}/details?url=${encodeURIComponent(ep.url)}`
      );
      const data = res.data;

      const buttons = data.downloads.map(d => ({
        buttonId: `dl|${encodeURIComponent(d.url)}`,
        buttonText: {
          displayText: `⬇️ ${d.quality} • ${d.size || "?"}`
        },
        type: 1
      }));

      return conn.sendMessage(from, {
        image: { url: data.poster },
        caption:
`📺 *${ep.title}*

👇 Select quality`,
        footer: "CineSubz • Mr Senal",
        buttons,
        headerType: 4
      }, { quoted: mek });
    }

  } catch (e) {
    console.error("NUMBER HANDLER ERROR:", e.message);
    reply("❌ Something went wrong");
  }
});

/* =========================
   ⬇️ DOWNLOAD BUTTON
========================= */
cmd({
  on: "button"
},
async (conn, mek, m) => {
  try {
    const id = m.buttonId;
    const from = mek.key.remoteJid;

    if (!id?.startsWith("dl|")) return;

    const countdownUrl = decodeURIComponent(id.split("|")[1]);

    await conn.sendMessage(from, {
      text: "⏳ Resolving download link..."
    }, { quoted: mek });

    const res = await axios.get(
      `${API}/download?url=${encodeURIComponent(countdownUrl)}`
    );

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
    console.error("DOWNLOAD ERROR:", e.message);
  }
});
                              
