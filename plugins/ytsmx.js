const { cmd } = require('../command');
const axios = require('axios');

const API = "https://mapi-beta.vercel.app";

/* =========================
   🎬 MOVIE / TV SEARCH
========================= */
cmd({
  pattern: "movie",
  alias: ["mv", "tv"],
  desc: "Search & download movies / TV series",
  category: "downloader",
  react: "🎬",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Example: .movie avatar");

    reply("🔍 *Searching... Please wait sir!*");

    const { data } = await axios.get(
      `${API}/search?q=${encodeURIComponent(q)}`
    );

    if (!data?.results?.length) {
      return reply("❌ No results found");
    }

    // limit to 5 results (WhatsApp button limit safe)
    const results = data.results.slice(0, 5);

    const buttons = results.map((v, i) => ({
      buttonId: `movie_select_${i}`,
      buttonText: {
        displayText: `${v.type === "tv" ? "📺" : "🎬"} ${v.title}`
      },
      type: 1
    }));

    // store results in memory (per chat)
    global.movieSearch ??= {};
    global.movieSearch[from] = results;

    await conn.sendMessage(from, {
      text: "🎬 *Search Results*\n\nSelect a movie / TV series 👇",
      footer: "CineSubz • Mr Senal",
      buttons,
      headerType: 1
    }, { quoted: mek });

  } catch (e) {
    console.error("SEARCH ERROR:", e);
    reply("❌ Search failed");
  }
});

/* =========================
   🔘 BUTTON HANDLER
========================= */
cmd({
  buttonHandler: async (conn, mek, btnId) => {
    const from = mek.key.remoteJid;

    try {
      /* =====================
         🎬 SELECT MOVIE / TV
      ====================== */
      if (btnId.startsWith("movie_select_")) {
        const index = parseInt(btnId.split("_")[2]);
        const item = global.movieSearch?.[from]?.[index];
        if (!item) return;

        const { data } = await axios.get(
          `${API}/details?url=${encodeURIComponent(item.url)}`
        );

        // MOVIE
        if (data.type !== "tv") {
          return sendDetails(conn, mek, from, data);
        }

        // TV SERIES → show episodes as buttons
        const epRes = await axios.get(
          `${API}/episodes?url=${encodeURIComponent(item.url)}`
        );

        global.tvEpisodes ??= {};
        global.tvEpisodes[from] = epRes.data;

        const eps = epRes.data.slice(0, 5); // button limit
        const buttons = eps.map((e, i) => ({
          buttonId: `tv_ep_${i}`,
          buttonText: { displayText: `🎞️ ${e.title}` },
          type: 1
        }));

        return conn.sendMessage(from, {
          image: { url: data.poster },
          caption: `📺 *${data.title}*\n\nSelect episode 👇`,
          footer: "CineSubz",
          buttons,
          headerType: 4
        }, { quoted: mek });
      }

      /* =====================
         📺 TV EPISODE SELECT
      ====================== */
      if (btnId.startsWith("tv_ep_")) {
        const index = parseInt(btnId.split("_")[2]);
        const ep = global.tvEpisodes?.[from]?.[index];
        if (!ep) return;

        const { data } = await axios.get(
          `${API}/details?url=${encodeURIComponent(ep.url)}`
        );

        return sendDetails(conn, mek, from, data);
      }

      /* =====================
         ⬇️ DOWNLOAD
      ====================== */
      if (btnId.startsWith("movie_dl_")) {
        const url = decodeURIComponent(btnId.replace("movie_dl_", ""));

        await conn.sendMessage(from, {
          text: "⏳ *Preparing download...*"
        }, { quoted: mek });

        const { data } = await axios.get(
          `${API}/download?url=${encodeURIComponent(url)}`
        );

        if (!data?.download) {
          return conn.sendMessage(from, {
            text: "❌ Download failed"
          }, { quoted: mek });
        }

        return conn.sendMessage(from, {
          document: { url: data.download },
          mimetype: "video/mp4",
          fileName: "movie.mp4",
          caption: "✅ Download started"
        }, { quoted: mek });
      }

    } catch (e) {
      console.error("BUTTON ERROR:", e);
      await conn.sendMessage(from, {
        text: "❌ Something went wrong"
      }, { quoted: mek });
    }
  }
});

/* =========================
   🎞 DETAILS UI
========================= */
async function sendDetails(conn, mek, from, data) {
  let caption = `🎬 *${data.title}*\n`;
  if (data.release) caption += `📅 Release: ${data.release}\n`;
  if (data.imdb) caption += `⭐ IMDb: ${data.imdb}\n`;
  if (data.duration) caption += `⏱️ Duration: ${data.duration}\n`;
  if (data.genre) caption += `🎭 Genre: ${data.genre.join(", ")}\n`;
  if (data.description) caption += `\n📝 ${data.description}\n`;

  const buttons = data.downloads.slice(0, 5).map(d => ({
    buttonId: `movie_dl_${encodeURIComponent(d.url)}`,
    buttonText: {
      displayText: `⬇️ ${d.quality} • ${d.size || "?"}`
    },
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
