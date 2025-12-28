const { cmd } = require('../command');
const axios = require('axios');

const API = "https://mapi-beta.vercel.app";
global.cineState = {};

/* =========================
   🔍 SEARCH
========================= */
cmd({
  pattern: "movie",
  alias: ["mv", "tv"],
  desc: "Movie & TV downloader",
  category: "downloader",
  react: "🎬",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Example: `.movie avatar`");

    reply("🔍 Searching...");

    const res = await axios.get(`${API}/search?q=${encodeURIComponent(q)}`);
    const results = res.data?.results;

    if (!results?.length) return reply("❌ No results found");

    const list = results.slice(0, 6);

    // ✅ SET STATE
    cineState[from] = {
      step: "search",
      data: list
    };

    let txt = "🎬 *Search Results*\n\n";
    list.forEach((v, i) => {
      txt += `${i + 1}. ${v.title}\n`;
    });
    txt += "\nReply with number";

    await conn.sendMessage(from, { text: txt }, { quoted: mek });

  } catch (e) {
    console.error(e);
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
    const state = cineState[from];
    if (!state) return; // ✅ IGNORE RANDOM NUMBERS

    const index = parseInt(m.text) - 1;
    if (index < 0) return reply("❌ Invalid number");

    /* ===== SELECT SEARCH RESULT ===== */
    if (state.step === "search") {
      const item = state.data[index];
      if (!item) return reply("❌ Invalid number");

      // CLEAR OLD STATE
      delete cineState[from];

      const res = await axios.get(
        `${API}/details?url=${encodeURIComponent(item.url)}`
      );
      const data = res.data;

      /* ===== TV SERIES ===== */
      if (data.type === "tv") {
        const epRes = await axios.get(
          `${API}/episodes?url=${encodeURIComponent(item.url)}`
        );

        if (!epRes.data?.length) {
          return reply("❌ No episodes found");
        }

        cineState[from] = {
          step: "episode",
          data: epRes.data
        };

        let txt = `📺 *${data.title}*\n\n`;
        epRes.data.slice(0, 10).forEach((e, i) => {
          txt += `${i + 1}. ${e.title}\n`;
        });
        txt += "\nReply with episode number";

        return conn.sendMessage(from, {
          image: { url: data.poster },
          caption: txt
        }, { quoted: mek });
      }

      /* ===== MOVIE ===== */
      return sendDownloadUI(conn, mek, from, data);
    }

    /* ===== SELECT EPISODE ===== */
    if (state.step === "episode") {
      const ep = state.data[index];
      if (!ep) return reply("❌ Invalid episode");

      delete cineState[from];

      const res = await axios.get(
        `${API}/details?url=${encodeURIComponent(ep.url)}`
      );

      return sendDownloadUI(conn, mek, from, res.data, ep.title);
    }

  } catch (e) {
    console.error(e);
    reply("❌ Error occurred");
  }
});

/* =========================
   🎞 DOWNLOAD UI
========================= */
async function sendDownloadUI(conn, mek, from, data, epTitle = "") {
  const buttons = data.downloads.map(d => ({
    buttonId: `dl|${encodeURIComponent(d.url)}`,
    buttonText: { displayText: `⬇️ ${d.quality} • ${d.size || "?"}` },
    type: 1
  }));

  await conn.sendMessage(from, {
    image: { url: data.poster },
    caption:
`🎬 *${epTitle || data.title}*

📝 ${data.description || "No description"}

👇 Select quality`,
    footer: "CineSubz • Mr Senal",
    buttons,
    headerType: 4
  }, { quoted: mek });
}

/* =========================
   ⬇️ DOWNLOAD
========================= */
cmd({ on: "button" }, async (conn, mek, m) => {
  try {
    const id = m.buttonId;
    const from = mek.key.remoteJid;

    if (!id?.startsWith("dl|")) return;

    const pageUrl = decodeURIComponent(id.split("|")[1]);

    await conn.sendMessage(from, { text: "⏳ Preparing download..." }, { quoted: mek });

    const res = await axios.get(
      `${API}/download?url=${encodeURIComponent(pageUrl)}`
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
    console.error(e);
  }
});
       
