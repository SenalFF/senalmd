require("dotenv").config();

const { cmd } = require("../command");
const axios = require("axios");

// ================== CONFIG ==================
const CINE_BASE = process.env.CINESUBZ_BASE || "https://cinesubz-v3.vercel.app";

const API = {
  search:   (q)       => `${CINE_BASE}/api/search?q=${encodeURIComponent(q)}`,
  details:  (url)     => `${CINE_BASE}/api/details?url=${encodeURIComponent(url)}`,
  player:   (post, n) => `${CINE_BASE}/api/player?post=${post}&nume=${n}`,
  episodes: (url)     => `${CINE_BASE}/api/tv/episodes?url=${encodeURIComponent(url)}`,
  episode:  (url)     => `${CINE_BASE}/api/tv/episode?url=${encodeURIComponent(url)}`
};

// ================== HELPERS ==================

// Retry: 30s first attempt, 60s on retry
async function safeGet(url, retries = 2) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const { data } = await axios.get(url, { timeout: i === 0 ? 30000 : 60000 });
      return data;
    } catch (err) {
      lastErr = err;
      if (err.response && err.response.status < 500) throw err; // don't retry 4xx
      if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw lastErr;
}

// Sends a "still working" message after delayMs if not cancelled
function sendDelayedUpdate(conn, remoteJid, mek, msg, delayMs = 12000) {
  let cancelled = false;
  const timer = setTimeout(async () => {
    if (!cancelled) {
      try { await conn.sendMessage(remoteJid, { text: msg }, { quoted: mek }); } catch (_) {}
    }
  }, delayMs);
  return () => { cancelled = true; clearTimeout(timer); };
}

function truncate(str = "", len = 30) {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

function encodeBtn(prefix, payload) {
  return `${prefix}::${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

function decodeBtn(btnId) {
  const sep = btnId.indexOf("::");
  if (sep === -1) return null;
  try {
    return {
      prefix: btnId.slice(0, sep),
      payload: JSON.parse(Buffer.from(btnId.slice(sep + 2), "base64url").toString("utf8"))
    };
  } catch { return null; }
}

function stars(rating) {
  const n = parseFloat(rating);
  if (isNaN(n)) return "N/A";
  const filled = Math.min(Math.round(n / 2), 5);
  return "⭐".repeat(filled) + "☆".repeat(5 - filled) + ` (${rating}/10)`;
}


// ==============================
//  SEARCH COMMAND  .movie <query>
// ==============================
cmd({
  pattern: "movie",
  alias: ["film", "cine", "cinema", "series"],
  desc: "🎬 CineSubz Movie & TV Downloader",
  category: "downloader",
  react: "🎬",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ *Usage:* .movie <title>\n\n*Example:* .movie Avatar");

    await reply("🔍 *Searching CineSubz...*");

    let data;
    try {
      data = await safeGet(API.search(q));
    } catch (err) {
      return reply(err.code === "ECONNABORTED"
        ? "⏳ *Search timed out. Please try again.*"
        : `❌ *Search failed:* ${err.message}`
      );
    }

    // API: { query, count, results: [...] }
    const results = Array.isArray(data) ? data : (data?.results || []);
    if (!results.length) return reply("❌ *No results found.*\nTry a different keyword.");

    const top = results.slice(0, 5);

    let text = `🎬 *CineSubz Search Results*\n`;
    text += `🔎 *"${q}"* — ${data.count || top.length} found\n`;
    text += `${"▬".repeat(20)}\n\n`;
    top.forEach((r, i) => {
      text += `*${i + 1}.* ${r.type === "tv" ? "📺" : "🎥"} *${r.title}*\n`;
      text += `   📅 ${r.year || "N/A"} • ⭐ ${r.imdb || "N/A"} • ⏱ ${r.runtime || "N/A"}\n`;
      text += `   🎭 ${truncate(r.genres || "N/A", 40)}\n\n`;
    });
    text += `${"▬".repeat(20)}\n👇 *Select a title:*`;

    // ✅ Store FULL search result in button — so we NEVER need details API for basic info
    // url from search result is used directly for details if needed
    const buttons = top.map((r, i) => ({
      buttonId: encodeBtn("cine_details", {
        // all data from search — no extra API call needed for basic display
        post_id:   r.post_id,
        url:       r.url,          // ← exact URL from search result
        title:     r.title,
        thumbnail: r.thumbnail,
        year:      r.year,
        imdb:      r.imdb,
        runtime:   r.runtime,
        genres:    r.genres,
        type:      r.type || "movie"
      }),
      buttonText: { displayText: `${i + 1}. ${truncate(r.title, 24)} (${r.year || "?"})` },
      type: 1
    }));

    await conn.sendMessage(from, {
      text,
      footer: "🎬 CineSubz v3 | Sinhala Subtitles",
      buttons
    }, { quoted: mek });

  } catch (e) {
    console.error("CineSubz Search Error:", e);
    reply("❌ Search failed. Please try again.");
  }
});


// ==============================
//  BUTTON HANDLER
// ==============================
cmd({
  buttonHandler: async (conn, mek, btnId) => {
    const remoteJid = mek.key.remoteJid;
    const decoded = decodeBtn(btnId);
    if (!decoded) return;
    const { prefix, payload } = decoded;

    try {

      // ────────────────────────────────
      // DETAILS — Show info card using search data first,
      //           then fetch full details from API using url from search results
      // ────────────────────────────────
      if (prefix === "cine_details") {
        const { post_id, url, title, thumbnail, year, imdb, runtime, genres, type } = payload;
        const isTv = type === "tv";

        // ── Step 1: Show quick card immediately using search data ──
        // User sees something right away — no waiting
        let quickText = `╔${"═".repeat(24)}╗\n`;
        quickText += `  🎬 *${truncate(title, 30)}*\n`;
        quickText += `╚${"═".repeat(24)}╝\n\n`;
        quickText += `${isTv ? "📺 *TV Series*" : "🎥 *Movie*"}\n`;
        quickText += `📅 *Year:* ${year || "N/A"}\n`;
        quickText += `⭐ *IMDb:* ${stars(imdb)}\n`;
        quickText += `⏱ *Runtime:* ${runtime || "N/A"}\n`;
        quickText += `🎭 *Genres:* ${genres || "N/A"}\n\n`;
        quickText += `⏳ *Loading full details...*`;

        // Send quick info with poster immediately
        if (thumbnail) {
          await conn.sendMessage(remoteJid, {
            image: { url: thumbnail },
            caption: quickText,
            footer: "🎬 CineSubz v3"
          }, { quoted: mek });
        } else {
          await conn.sendMessage(remoteJid, { text: quickText }, { quoted: mek });
        }

        // ── Step 2: Fetch full details using URL directly from search results ──
        const cancel = sendDelayedUpdate(
          conn, remoteJid, mek,
          "⏳ *Still loading full details... CineSubz is responding slowly.*",
          15000
        );

        let d = null;
        try {
          // url is exactly what came from search API — use it directly
          d = await safeGet(API.details(url));
          cancel();
        } catch (err) {
          cancel();
          // Details failed — but we already showed quick info
          // Fall back to post_id for player buttons
          d = null;
          await conn.sendMessage(remoteJid, {
            text: `⚠️ *Could not load full details* (server slow).\nShowing download options based on available data.`
          }, { quoted: mek });
        }

        // ── Step 3: Build full details card + download buttons ──
        let text = `╔${"═".repeat(24)}╗\n`;
        text += `  🎬 *${d?.title || title}*\n`;
        text += `╚${"═".repeat(24)}╝\n\n`;
        text += `${isTv ? "📺 *TV Series*" : "🎥 *Movie*"}\n`;
        text += `📅 *Year:* ${d?.year || year || "N/A"}\n`;
        text += `⭐ *IMDb:* ${stars(d?.imdb || imdb)}\n`;
        if (d?.site_rating) text += `🌟 *Site Rating:* ${d.site_rating} (${d.site_rating_count || ""})\n`;
        text += `⏱ *Runtime:* ${d?.runtime || runtime || "N/A"}\n`;
        text += `🌐 *Country/Lang:* ${d?.country || "N/A"}\n`;
        text += `🎭 *Genres:* ${Array.isArray(d?.genres) ? d.genres.join(", ") : (d?.genres || genres || "N/A")}\n`;
        if (d?.director)    text += `🎬 *Director:* ${d.director}\n`;
        if (d?.quality)     text += `🎞 *Quality:* ${d.quality}\n`;
        if (d?.subtitle_by) text += `💬 *Subs by:* ${d.subtitle_by}\n`;
        if (d?.tagline)     text += `\n💬 _${d.tagline}_\n`;
        if (d?.description) text += `\n📝 *Synopsis:*\n${d.description.slice(0, 350)}...\n`;
        text += `\n${"▬".repeat(20)}\n`;

        const buttons = [];
        const downloads = d?.downloads || [];
        const players   = d?.players   || [];

        if (isTv) {
          text += "👇 *Browse Episodes:*";
          buttons.push({
            buttonId: encodeBtn("cine_episodes", { url, title: truncate(d?.title || title, 22) }),
            buttonText: { displayText: "📺 Browse Seasons & Episodes" },
            type: 1
          });

        } else if (downloads.length) {
          text += "👇 *Select Quality to Download:*";
          const direct = downloads.filter(x => x.type?.toLowerCase().includes("direct"));
          const tg     = downloads.filter(x => x.type?.toLowerCase().includes("telegram"));
          const show   = (direct.length ? direct : tg).slice(0, 3);

          show.forEach(dl => {
            buttons.push({
              buttonId: encodeBtn("cine_download", {
                dlUrl:   dl.url,
                quality: dl.quality,
                title:   truncate(d?.title || title, 24)
              }),
              buttonText: { displayText: `⬇️ ${truncate(dl.quality, 30)}` },
              type: 1
            });
          });

          if (direct.length && tg.length && buttons.length < 3) {
            buttons.push({
              buttonId: encodeBtn("cine_dl_tg", {
                downloads: tg,
                title: truncate(d?.title || title, 24)
              }),
              buttonText: { displayText: "📲 Telegram Links" },
              type: 1
            });
          }

        } else if (players.length) {
          text += "👇 *Select Player:*";
          players.slice(0, 3).forEach(p => {
            buttons.push({
              buttonId: encodeBtn("cine_play", {
                post:  p.post  || post_id,
                nume:  p.nume,
                title: truncate(d?.title || title, 24)
              }),
              buttonText: { displayText: `▶️ ${p.name || `Player ${p.nume}`}` },
              type: 1
            });
          });

        } else {
          // Last resort fallback — use post_id from search to try player directly
          text += "👇 *Download:*";
          buttons.push({
            buttonId: encodeBtn("cine_play", {
              post:  post_id,
              nume:  "1",
              title: truncate(d?.title || title, 24)
            }),
            buttonText: { displayText: "▶️ Player 01" },
            type: 1
          });
          buttons.push({
            buttonId: encodeBtn("cine_play", {
              post:  post_id,
              nume:  "2",
              title: truncate(d?.title || title, 24)
            }),
            buttonText: { displayText: "▶️ Player 02" },
            type: 1
          });
        }

        const poster = d?.poster || d?.thumbnail || thumbnail;
        if (poster) {
          return await conn.sendMessage(remoteJid, {
            image: { url: poster },
            caption: text,
            footer: "🎬 CineSubz v3",
            buttons,
            headerType: 4
          }, { quoted: mek });
        }

        return await conn.sendMessage(remoteJid, {
          text, footer: "🎬 CineSubz v3", buttons
        }, { quoted: mek });
      }


      // ────────────────────────────────
      // DIRECT DOWNLOAD
      // ────────────────────────────────
      if (prefix === "cine_download") {
        const { dlUrl, quality, title } = payload;

        await conn.sendMessage(remoteJid, {
          text: `⏳ *Sending file...*\n🎬 _${title}_\n🎞 ${quality}`
        }, { quoted: mek });

        const cancel = sendDelayedUpdate(
          conn, remoteJid, mek,
          "⏳ *Still uploading... Large files take time. Please wait.*",
          20000
        );

        const caption = `
╔${"═".repeat(24)}╗
  🎬 *${title}*
╚${"═".repeat(24)}╝

🎞 *Quality:* ${quality}
💬 *Subtitles:* Sinhala | සිංහල
${"▬".repeat(20)}
✅ *CineSubz v3 | සිංහල උපසිරැසි*
        `.trim();

        try {
          await conn.sendMessage(remoteJid, {
            document: { url: dlUrl },
            mimetype: "video/mp4",
            fileName: `${title.replace(/[^\w\s\-()]/g, "").trim()}.mp4`,
            caption
          }, { quoted: mek });
          cancel();
        } catch {
          cancel();
          await conn.sendMessage(remoteJid, {
            text: `⚠️ *Could not auto-send file.*\n\n🔗 *Direct Download Link:*\n${dlUrl}\n\n💡 Open in browser to download.`
          }, { quoted: mek });
        }
        return;
      }


      // ────────────────────────────────
      // TELEGRAM LINKS
      // ────────────────────────────────
      if (prefix === "cine_dl_tg") {
        const { downloads, title } = payload;

        let text = `📲 *Telegram Download Links*\n🎬 *${title}*\n${"▬".repeat(20)}\n\n`;
        downloads.forEach((dl, i) => {
          text += `*${i + 1}.* ${dl.quality}\n🔗 ${dl.url}\n\n`;
        });
        text += "💡 Open links in Telegram or browser to download.";

        return await conn.sendMessage(remoteJid, { text }, { quoted: mek });
      }


      // ────────────────────────────────
      // PLAYER API → fetch video_url
      // ────────────────────────────────
      if (prefix === "cine_play") {
        const { post, nume, title } = payload;

        await conn.sendMessage(remoteJid, {
          text: `⏳ *Fetching player...*\n🎬 _${title}_`
        }, { quoted: mek });

        const cancel = sendDelayedUpdate(
          conn, remoteJid, mek,
          "⏳ *Still resolving video link... please wait.*",
          15000
        );

        let pd;
        try {
          pd = await safeGet(API.player(post, nume));
          cancel();
        } catch (err) {
          cancel();
          return await conn.sendMessage(remoteJid, {
            text: err.code === "ECONNABORTED"
              ? "⏳ *Player timed out. Please try again.*"
              : `❌ Player error: \`${err.message}\``
          }, { quoted: mek });
        }

        if (!pd) return await conn.sendMessage(remoteJid, { text: "❌ Player returned no data." }, { quoted: mek });

        const videoUrl = pd.video_url || pd.raw_url || null;
        const embedUrl = pd.raw_embed || pd.iframe_url || null;
        const subtUrl  = pd.subtitle_url || null;
        const vidType  = pd.video_type || "mp4";

        if (!videoUrl && !embedUrl) {
          return await conn.sendMessage(remoteJid, {
            text: `❌ Could not extract video link.\n\`${JSON.stringify(pd).slice(0, 300)}\``
          }, { quoted: mek });
        }

        if (videoUrl) {
          const caption = `
╔${"═".repeat(24)}╗
  🎬 *${title}*
╚${"═".repeat(24)}╝

🎞 *Format:* ${vidType.toUpperCase()}
💬 *Subtitles:* ${subtUrl ? "✅ Sinhala" : "❌ None"}
${"▬".repeat(20)}
✅ *CineSubz v3 | සිංහල උපසිරැසි*
          `.trim();

          try {
            await conn.sendMessage(remoteJid, {
              document: { url: videoUrl },
              mimetype: "video/mp4",
              fileName: `${title.replace(/[^\w\s\-()]/g, "").trim()}.mp4`,
              caption
            }, { quoted: mek });
          } catch {
            await conn.sendMessage(remoteJid, {
              text: `⚠️ *Could not send file.*\n\n🔗 *Video Link:*\n${videoUrl}`
            }, { quoted: mek });
          }

          if (subtUrl) {
            await conn.sendMessage(remoteJid, {
              document: { url: subtUrl },
              mimetype: "text/plain",
              fileName: `${title.replace(/[^\w\s\-()]/g, "").trim()}_sinhala.srt`,
              caption: "💬 *Sinhala Subtitle File (.srt)*"
            }, { quoted: mek });
          }
          return;
        }

        // Fallback embed only
        return await conn.sendMessage(remoteJid, {
          text: `🎬 *${title}*\n\n⚠️ *Direct download unavailable.*\n\n🔗 *Watch/Download:*\n${embedUrl}\n\n💡 Open in browser to download.`
        }, { quoted: mek });
      }


      // ────────────────────────────────
      // TV EPISODES — Season list
      // ────────────────────────────────
      if (prefix === "cine_episodes") {
        const { url, title } = payload;

        await conn.sendMessage(remoteJid, {
          text: `⏳ *Loading seasons...*\n📺 _${title}_`
        }, { quoted: mek });

        const cancel = sendDelayedUpdate(conn, remoteJid, mek, "⏳ *Still loading seasons...*", 15000);

        let epData;
        try {
          epData = await safeGet(API.episodes(url));
          cancel();
        } catch (err) {
          cancel();
          return await conn.sendMessage(remoteJid, {
            text: err.code === "ECONNABORTED"
              ? "⏳ *Timed out loading seasons. Try again.*"
              : `❌ Error: \`${err.message}\``
          }, { quoted: mek });
        }

        const seasons = epData?.seasons || [];
        if (!seasons.length) return await conn.sendMessage(remoteJid, { text: "❌ No seasons found." }, { quoted: mek });

        let text = `📺 *${title}*\n${"▬".repeat(20)}\n🗂 *${seasons.length} Season(s)*\n\n👇 Select a season:`;

        const buttons = seasons.slice(0, 3).map((s, i) => ({
          buttonId: encodeBtn("cine_season", {
            episodes: s.episodes,
            season:   s.season || `Season ${i + 1}`,
            title:    truncate(title, 22),
            page: 0
          }),
          buttonText: { displayText: `📂 ${s.season || `Season ${i + 1}`} — ${s.episodes?.length || 0} eps` },
          type: 1
        }));

        return await conn.sendMessage(remoteJid, { text, footer: "📺 CineSubz v3", buttons }, { quoted: mek });
      }


      // ────────────────────────────────
      // SEASON → Episodes paginated
      // ────────────────────────────────
      if (prefix === "cine_season") {
        const { episodes = [], season, title, page = 0 } = payload;
        if (!episodes.length) return await conn.sendMessage(remoteJid, { text: "❌ No episodes found." }, { quoted: mek });

        const PAGE = 2;
        const start = page * PAGE;
        const slice = episodes.slice(start, start + PAGE);
        const hasMore = start + PAGE < episodes.length;

        let text = `📺 *${title}*\n📂 *${season}*\n${"▬".repeat(20)}\n`;
        text += `🎞 ${episodes.length} Episodes • Page ${page + 1}\n\n👇 Select episode:`;

        const buttons = slice.map(ep => ({
          buttonId: encodeBtn("cine_episode", {
            epUrl:     ep.url,
            epTitle:   truncate(ep.title || ep.episode || "Episode", 22),
            showTitle: title
          }),
          buttonText: { displayText: `▶️ ${truncate(ep.title || ep.episode || "Episode", 28)}` },
          type: 1
        }));

        if (hasMore) {
          buttons.push({
            buttonId: encodeBtn("cine_season", { episodes, season, title, page: page + 1 }),
            buttonText: { displayText: `⏭ More (${start + PAGE + 1}–${Math.min(start + PAGE * 2, episodes.length)})` },
            type: 1
          });
        }

        return await conn.sendMessage(remoteJid, {
          text, footer: `📂 ${season} • CineSubz v3`, buttons
        }, { quoted: mek });
      }


      // ────────────────────────────────
      // SINGLE EPISODE → resolve
      // ────────────────────────────────
      if (prefix === "cine_episode") {
        const { epUrl, epTitle, showTitle } = payload;

        await conn.sendMessage(remoteJid, {
          text: `⏳ *Resolving episode...*\n🎞 _${epTitle}_`
        }, { quoted: mek });

        const cancel = sendDelayedUpdate(conn, remoteJid, mek, "⏳ *Still resolving episode...*", 15000);

        let ep;
        try {
          ep = await safeGet(API.episode(epUrl));
          cancel();
        } catch (err) {
          cancel();
          return await conn.sendMessage(remoteJid, {
            text: err.code === "ECONNABORTED"
              ? "⏳ *Timed out. Please try again.*"
              : `❌ Error: \`${err.message}\``
          }, { quoted: mek });
        }

        if (!ep) return await conn.sendMessage(remoteJid, { text: "❌ Could not resolve episode." }, { quoted: mek });

        const players    = ep.players   || [];
        const downloads  = ep.downloads || [];
        const fallbackId = ep.post_id   || ep.id;

        let text = `╔${"═".repeat(24)}╗\n  📺 *${showTitle}*\n╚${"═".repeat(24)}╝\n\n`;
        text += `🎞 *Episode:* ${epTitle}\n${"▬".repeat(20)}\n👇 Select quality:`;

        const buttons = [];

        if (downloads.length) {
          downloads.slice(0, 3).forEach(dl => {
            buttons.push({
              buttonId: encodeBtn("cine_download", {
                dlUrl: dl.url, quality: dl.quality,
                title: `${showTitle} - ${epTitle}`
              }),
              buttonText: { displayText: `⬇️ ${truncate(dl.quality, 30)}` },
              type: 1
            });
          });
        } else if (players.length) {
          players.slice(0, 3).forEach(p => {
            buttons.push({
              buttonId: encodeBtn("cine_play", {
                post: p.post, nume: p.nume,
                title: `${showTitle} - ${epTitle}`
              }),
              buttonText: { displayText: `▶️ ${p.name || `Player ${p.nume}`}` },
              type: 1
            });
          });
        } else if (fallbackId) {
          buttons.push({
            buttonId: encodeBtn("cine_play", {
              post: fallbackId, nume: "1",
              title: `${showTitle} - ${epTitle}`
            }),
            buttonText: { displayText: "⬇️ Download Episode" },
            type: 1
          });
        } else {
          text += "\n\n❌ *No download options available.*";
        }

        return await conn.sendMessage(remoteJid, {
          text, footer: "📺 CineSubz v3", buttons
        }, { quoted: mek });
      }

    } catch (err) {
      console.error("CineSubz Button Error:", err);
      await conn.sendMessage(remoteJid, {
        text: err.code === "ECONNABORTED"
          ? "⏳ *Request timed out. Please try again.*"
          : `❌ Error: \`${err.message}\``
      }, { quoted: mek });
    }
  }
});
