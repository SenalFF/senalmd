require("dotenv").config();
const { cmd } = require("../command");
const axios = require("axios");

/* ================= CONFIG ================= */

const CINE_BASE =
  process.env.CINESUBZ_BASE || "https://cinesubz-v3.vercel.app";

const API = {
  search: (q) =>
    `${CINE_BASE}/api/search?q=${encodeURIComponent(q)}`,
  details: (url) =>
    `${CINE_BASE}/api/details?url=${encodeURIComponent(url)}`,
  player: (post, n) =>
    `${CINE_BASE}/api/player?post=${post}&nume=${n}`,
  episodes: (url) =>
    `${CINE_BASE}/api/tv/episodes?url=${encodeURIComponent(url)}`,
  episode: (url) =>
    `${CINE_BASE}/api/tv/episode?url=${encodeURIComponent(url)}`,
};

/* ================= SAFE GET ================= */

async function safeGet(url, retries = 2) {
  let lastErr;

  for (let i = 0; i < retries; i++) {
    try {
      console.log("🌍 Calling API:", url);

      const { data } = await Promise.race([
        axios.get(url, { timeout: 15000 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request Timeout")), 20000)
        ),
      ]);

      console.log("✅ API Success");
      if (!data || data.status === false)
        throw new Error("API returned invalid response");

      return data;
    } catch (err) {
      console.log("❌ API Error:", err.message);
      lastErr = err;

      if (i < retries - 1) {
        console.log("🔁 Retrying...");
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  throw lastErr;
}

/* ================= HELPERS ================= */

function truncate(str = "", len = 30) {
  return str.length > len
    ? str.slice(0, len - 1) + "…"
    : str;
}

function stars(rating) {
  const n = parseFloat(rating);
  if (isNaN(n)) return "N/A";
  const filled = Math.min(Math.round(n / 2), 5);
  return (
    "⭐".repeat(filled) +
    "☆".repeat(5 - filled) +
    ` (${rating}/10)`
  );
}

function encodeBtn(prefix, payload) {
  return `${prefix}::${Buffer.from(
    JSON.stringify(payload)
  ).toString("base64url")}`;
}

function decodeBtn(btnId) {
  const sep = btnId.indexOf("::");
  if (sep === -1) return null;
  try {
    return {
      prefix: btnId.slice(0, sep),
      payload: JSON.parse(
        Buffer.from(
          btnId.slice(sep + 2),
          "base64url"
        ).toString("utf8")
      ),
    };
  } catch {
    return null;
  }
}

/* ================= MEMORY ================= */

const userLastSearch = {};
const userLastDetails = {};

/* =====================================================
   CMD 1 — SEARCH
===================================================== */

cmd(
  {
    pattern: "csearch",
    alias: ["cs"],
    desc: "Search CineSubz movies/series",
    category: "downloader",
    react: "🔍",
    filename: __filename,
  },
  async (conn, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("Usage: .csearch <title>");

      await reply("🔍 Searching CineSubz...");

      let data;

      try {
        data = await safeGet(API.search(q));
      } catch (err) {
        return reply("❌ Search failed:\n" + err.message);
      }

      const results =
        Array.isArray(data) ? data : data.results || [];

      if (!results.length)
        return reply("❌ No results found.");

      userLastSearch[from] = results;

      const top = results.slice(0, 5);

      let text =
        `🎬 *CineSubz Results*\n\n`;

      top.forEach((r, i) => {
        text += `*${i + 1}.* ${
          r.type === "tv" ? "📺" : "🎥"
        } ${r.title}\n`;
        text += `   📅 ${r.year || "N/A"}\n`;
        text += `   ⭐ ${r.imdb || "N/A"}\n`;
        text += `   🆔 ${r.post_id}\n\n`;
      });

      const buttons = top.map((r) => ({
        buttonId: encodeBtn("cine_details", {
          post_id: r.post_id,
          url: r.url,
          title: r.title,
        }),
        buttonText: {
          displayText: truncate(r.title, 25),
        },
        type: 1,
      }));

      return await conn.sendMessage(
        from,
        {
          text,
          footer: "CineSubz v3",
          buttons,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.log("Search Error:", e);
      reply("❌ Unexpected error.");
    }
  }
);

/* =====================================================
   CMD 2 — DETAILS
===================================================== */

cmd(
  {
    pattern: "cdetails",
    alias: ["cd"],
    desc: "Get movie details",
    category: "downloader",
    react: "📋",
    filename: __filename,
  },
  async (conn, mek, m, { from, q, reply }) => {
    try {
      if (!q)
        return reply("Usage: .cdetails <post_id>");

      const lastSearch =
        userLastSearch[from] || [];

      const found = lastSearch.find(
        (r) => r.post_id == q
      );

      if (!found)
        return reply(
          "❌ Run .csearch first."
        );

      await reply("⏳ Fetching details...");

      let d;

      try {
        d = await safeGet(
          API.details(found.url)
        );
      } catch (err) {
        return reply(
          "❌ Failed:\n" + err.message
        );
      }

      userLastDetails[from] = d;

      let text = `🎬 *${d.title}*\n\n`;
      text += `📅 ${d.year}\n`;
      text += `⭐ ${stars(d.imdb)}\n`;
      text += `⏱ ${d.runtime}\n`;
      text += `🎭 ${
        Array.isArray(d.genres)
          ? d.genres.join(", ")
          : "N/A"
      }\n\n`;

      const downloads = d.downloads || [];

      if (!downloads.length)
        return reply(
          "❌ No downloads available."
        );

      const buttons = downloads
        .slice(0, 3)
        .map((dl) => ({
          buttonId: encodeBtn(
            "cine_download",
            {
              url: dl.url,
              quality: dl.quality,
              title: d.title,
            }
          ),
          buttonText: {
            displayText: dl.quality,
          },
          type: 1,
        }));

      return await conn.sendMessage(
        from,
        {
          text,
          image: {
            url:
              d.poster ||
              d.thumbnail,
          },
          footer: "CineSubz v3",
          buttons,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.log("Details Error:", e);
      reply("❌ Error occurred.");
    }
  }
);

/* =====================================================
   BUTTON HANDLER
===================================================== */

cmd({
  buttonHandler: async (
    conn,
    mek,
    btnId
  ) => {
    const remoteJid =
      mek.key.remoteJid;

    const decoded =
      decodeBtn(btnId);
    if (!decoded) return;

    const { prefix, payload } =
      decoded;

    try {
      /* DOWNLOAD */
      if (prefix === "cine_download") {
        const { url, title, quality } =
          payload;

        await conn.sendMessage(
          remoteJid,
          {
            text: `⏳ Uploading ${title} (${quality})...`,
          },
          { quoted: mek }
        );

        try {
          await conn.sendMessage(
            remoteJid,
            {
              document: { url },
              mimetype:
                "video/mp4",
              fileName: `${title}.mp4`,
              caption: `🎬 ${title}\n🎞 ${quality}`,
            },
            { quoted: mek }
          );
        } catch {
          await conn.sendMessage(
            remoteJid,
            {
              text:
                "⚠️ Could not send file.\n\n" +
                url,
            },
            { quoted: mek }
          );
        }
      }
    } catch (err) {
      await conn.sendMessage(
        remoteJid,
        {
          text:
            "❌ Error:\n" +
            err.message,
        },
        { quoted: mek }
      );
    }
  },
});
