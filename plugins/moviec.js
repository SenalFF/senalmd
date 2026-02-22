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
async function safeGet(url, retries = 2) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const { data } = await axios.get(url, { timeout: i === 0 ? 30000 : 60000 });
      return data;
    } catch (err) {
      lastErr = err;
      if (err.response && err.response.status < 500) throw err;
      if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw lastErr;
}

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

// Store last search results per user (in-memory, keyed by remoteJid)
const userLastSearch = {};
// Store last details per user
const userLastDetails = {};


// ══════════════════════════════════════════
//  CMD 1 — SEARCH
//  .csearch <query>
//  Searches CineSubz and shows results with numbered buttons
// ══════════════════════════════════════════
cmd({
  pattern: "csearch",
  alias: ["cs", "cmovie", "cinesearch"],
  desc: "🔍 Search CineSubz for movies & series",
  category: "downloader",
  react: "🔍",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply(
      `❗ *Usage:* .csearch <title>\n\n` +
      `*Example:* .csearch RRR\n\n` +
      `*Other Commands:*\n` +
      `▸ .cdetails <post_id or url> — Get full details\n` +
      `▸ .cplayer <post_id> <nume> — Get video link\n` +
      `▸ .cepisodes <url> — List TV episodes\n` +
      `▸ .cepisode <url> — Resolve single episode`
    );

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

    const results = Array.isArray(data) ? data : (data?.results || []);
    if (!results.length) return reply("❌ *No results found.*\nTry a different keyword.");

    // Save to memory for this user
    userLastSearch[from] = results;

    const top = results.slice(0, 5);

    let text = `🎬 *CineSubz Search Results*\n`;
    text += `🔎 *"${q}"* — ${data.count || top.length} found\n`;
    text += `${"▬".repeat(20)}\n\n`;
    top.forEach((r, i) => {
      text += `*${i + 1}.* ${r.type === "tv" ? "📺" : "🎥"} *${r.title}*\n`;
      text += `   📅 ${r.year || "N/A"} • ⭐ ${r.imdb || "N/A"} • ⏱ ${r.runtime || "N/A"}\n`;
      text += `   🎭 ${truncate(r.genres || "N/A", 40)}\n`;
      text += `   🆔 Post ID: \`${r.post_id}\`\n\n`;
    });
    text += `${"▬".repeat(20)}\n`;
    text += `👇 *Select a result OR use:*\n`;
    text += `📌 *.cdetails <post_id>* to get full info`;

    const buttons = top.map((r, i) => ({
      buttonId: encodeBtn("cine_details", {
        post_id:   r.post_id,
        url:       r.url,
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
      footer: "🎬 CineSubz v3 | .csearch",
      buttons
    }, { quoted: mek });

  } catch (e) {
    console.error("csearch Error:", e);
    reply("❌ Search failed. Please try again.");
  }
});


// ══════════════════════════════════════════
//  CMD 2 — DETAILS
//  .cdetails <post_id or url>
//  Fetches full movie/series details and shows download buttons
// ══════════════════════════════════════════
cmd({
  pattern: "cdetails",
  alias: ["cd", "cinedetails", "cinfo"],
  desc: "📋 Get full details of a CineSubz movie/series",
  category: "downloader",
  react: "📋",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply(
      `❗ *Usage:* .cdetails <post_id or url>\n\n` +
      `*Examples:*\n` +
      `▸ .cdetails 34619\n` +
      `▸ .cdetails https://cinesubz.lk/movies/rrr-2022-sinhala-sub/\n\n` +
      `💡 Use *.csearch* first to find post IDs`
    );

    // Determine if input is a URL or post_id
    let detailUrl = q.trim();
    let post_id = null;

    if (!detailUrl.startsWith("http")) {
      // It's a post_id — try to find URL from last search results
      post_id = detailUrl;
      const lastSearch = userLastSearch[from] || [];
      const found = lastSearch.find(r => r.post_id === post_id);
      if (found) {
        detailUrl = found.url;
      } else {
        return reply(
          `❌ *URL not found for post_id* \`${post_id}\`\n\n` +
          `Please run *.csearch <title>* first, or pass the full URL:\n` +
          `*.cdetails https://cinesubz.lk/movies/...*`
        );
      }
    }

    await reply(`⏳ *Fetching details...*\n🔗 ${truncate(detailUrl, 50)}`);

    const cancel = sendDelayedUpdate(
      conn, from, mek,
      "⏳ *Still loading details... CineSubz is responding slowly.*",
      15000
    );

    let d;
    try {
      d = await safeGet(API.details(detailUrl));
      cancel();
    } catch (err) {
      cancel();
      return await conn.sendMessage(from, {
        text: err.code === "ECONNABORTED"
          ? `⏳ *Details timed out.*\n\n💡 Try again or use:\n*.cplayer ${post_id || "POST_ID"} 1*`
          : `❌ *Failed to load details:* ${err.message}`
      }, { quoted: mek });
    }

    if (!d) return reply("❌ Empty response from server.");

    // Save to memory for this user
    userLastDetails[from] = d;

    const isTv = d.type === "tv";

    let text = `╔${"═".repeat(24)}╗\n`;
    text += `  🎬 *${d.title}*\n`;
    text += `╚${"═".repeat(24)}╝\n\n`;
    text += `${isTv ? "📺 *TV Series*" : "🎥 *Movie*"}\n`;
    text += `📅 *Year:* ${d.year || "N/A"}\n`;
    text += `⭐ *IMDb:* ${stars(d.imdb)}\n`;
    if (d.site_rating) text += `🌟 *Site Rating:* ${d.site_rating} (${d.site_rating_count || ""})\n`;
    text += `⏱ *Runtime:* ${d.runtime || "N/A"}\n`;
    text += `🌐 *Country/Lang:* ${d.country || "N/A"}\n`;
    text += `🎭 *Genres:* ${Array.isArray(d.genres) ? d.genres.join(", ") : "N/A"}\n`;
    if (d.director)    text += `🎬 *Director:* ${d.director}\n`;
    if (d.quality)     text += `🎞 *Quality:* ${d.quality}\n`;
    if (d.subtitle_by) text += `💬 *Subs by:* ${d.subtitle_by}\n`;
    text += `🆔 *Post ID:* \`${d.post_id}\`\n`;
    if (d.tagline) text += `\n💬 _${d.tagline}_\n`;
    if (d.description) text += `\n📝 *Synopsis:*\n${d.description.slice(0, 400)}...\n`;
    text += `\n${"▬".repeat(20)}\n`;

    const buttons = [];
    const downloads = d.downloads || [];
    const players   = d.players   || [];

    if (isTv) {
      // TV Series
      text += `📺 *TV Series* — use *.cepisodes <url>*\n`;
      text += `🔗 \`${detailUrl}\`\n\n`;
      text += `👇 *Or click below:*`;
      buttons.push({
        buttonId: encodeBtn("cine_episodes", { url: detailUrl, title: truncate(d.title, 22) }),
        buttonText: { displayText: "📺 Browse Seasons & Episodes" },
        type: 1
      });
    } else if (downloads.length) {
      text += `*Download options:*\n`;
      downloads.forEach((dl, i) => {
        text += `${i + 1}. ${dl.quality}\n`;
      });
      text += `\n👇 *Select quality:*`;

      const direct = downloads.filter(x => x.type?.toLowerCase().includes("direct"));
      const tg     = downloads.filter(x => x.type?.toLowerCase().includes("telegram"));
      const show   = (direct.length ? direct : tg).slice(0, 3);

      show.forEach(dl => {
        buttons.push({
          buttonId: encodeBtn("cine_download", {
            dlUrl:   dl.url,
            quality: dl.quality,
            title:   truncate(d.title, 24)
          }),
          buttonText: { displayText: `⬇️ ${truncate(dl.quality, 30)}` },
          type: 1
        });
      });

      if (direct.length && tg.length && buttons.length < 3) {
        buttons.push({
          buttonId: encodeBtn("cine_dl_tg", { downloads: tg, title: truncate(d.title, 24) }),
          buttonText: { displayText: "📲 Telegram Links" },
          type: 1
        });
      }
    } else if (players.length) {
      text += `*Players available:*\n`;
      players.forEach(p => { text += `▸ ${p.name} (nume: ${p.nume}, post: ${p.post})\n`; });
      text += `\n💡 Use: *.cplayer ${players[0].post} ${players[0].nume}*\n\n`;
      text += `👇 *Or click below:*`;

      players.slice(0, 3).forEach(p => {
        buttons.push({
          buttonId: encodeBtn("cine_play", { post: p.post, nume: p.nume, title: truncate(d.title, 24) }),
          buttonText: { displayText: `▶️ ${p.name || `Player ${p.nume}`}` },
          type: 1
        });
      });
    } else {
      text += "❌ *No download options found.*";
    }

    const poster = d.poster || d.thumbnail || d.image;
    if (poster) {
      return await conn.sendMessage(from, {
        image: { url: poster },
        caption: text,
        footer: "🎬 CineSubz v3 | .cdetails",
        buttons,
        headerType: 4
      }, { quoted: mek });
    }

    return await conn.sendMessage(from, {
      text, footer: "🎬 CineSubz v3 | .cdetails", buttons
    }, { quoted: mek });

  } catch (e) {
    console.error("cdetails Error:", e);
    reply("❌ Failed to fetch details. Please try again.");
  }
});


// ══════════════════════════════════════════
//  CMD 3 — PLAYER
//  .cplayer <post_id> <nume>
//  Fetches video URL from player API and sends the file
// ══════════════════════════════════════════
cmd({
  pattern: "cplayer",
  alias: ["cp", "cineplayer", "cplay"],
  desc: "▶️ Fetch and send video from CineSubz player",
  category: "downloader",
  react: "▶️",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply(
      `❗ *Usage:* .cplayer <post_id> <nume>\n\n` +
      `*Examples:*\n` +
      `▸ .cplayer 34619 1\n` +
      `▸ .cplayer 34619 2\n\n` +
      `💡 Find post_id using *.csearch* or *.cdetails*\n` +
      `💡 nume is the player number (1, 2, 3...)`
    );

    const parts = q.trim().split(/\s+/);
    const post  = parts[0];
    const nume  = parts[1] || "1";

    if (!post) return reply("❗ Please provide a post_id. Example: `.cplayer 34619 1`");

    await reply(`⏳ *Fetching player ${nume}...*\n🆔 Post: \`${post}\``);

    const cancel = sendDelayedUpdate(
      conn, from, mek,
      "⏳ *Still resolving video link... please wait.*",
      15000
    );

    let pd;
    try {
      pd = await safeGet(API.player(post, nume));
      cancel();
    } catch (err) {
      cancel();
      return await conn.sendMessage(from, {
        text: err.code === "ECONNABORTED"
          ? "⏳ *Player timed out. Please try again.*"
          : `❌ *Player error:* ${err.message}`
      }, { quoted: mek });
    }

    if (!pd) return reply("❌ Player returned no data.");

    const videoUrl = pd.video_url || pd.raw_url  || null;
    const embedUrl = pd.raw_embed || pd.iframe_url || null;
    const subtUrl  = pd.subtitle_url || null;
    const vidType  = pd.video_type   || "mp4";

    // Show what the API returned
    let infoText = `📡 *Player API Response*\n${"▬".repeat(20)}\n`;
    infoText += `🆔 *Post:* ${post} | *Nume:* ${nume}\n`;
    infoText += `🎞 *Type:* ${vidType.toUpperCase()}\n`;
    infoText += `🎬 *Video URL:* ${videoUrl ? "✅ Found" : "❌ None"}\n`;
    infoText += `🖼 *Embed URL:* ${embedUrl ? "✅ Found" : "❌ None"}\n`;
    infoText += `💬 *Subtitle:* ${subtUrl ? "✅ Found" : "❌ None"}\n`;

    await conn.sendMessage(from, { text: infoText }, { quoted: mek });

    if (!videoUrl && !embedUrl) {
      return await conn.sendMessage(from, {
        text: `❌ *No video link found.*\n\n*Raw response:*\n\`\`\`${JSON.stringify(pd).slice(0, 400)}\`\`\``
      }, { quoted: mek });
    }

    if (videoUrl) {
      // Get title from last details if available
      const title = userLastDetails[from]?.title || `CineSubz_${post}_${nume}`;

      const caption = `
╔${"═".repeat(24)}╗
  🎬 *${title}*
╚${"═".repeat(24)}╝

🎞 *Format:* ${vidType.toUpperCase()}
🆔 *Post:* ${post} | *Player:* ${nume}
💬 *Subtitles:* ${subtUrl ? "✅ Sinhala" : "❌ None"}
${"▬".repeat(20)}
✅ *CineSubz v3 | සිංහල උපසිරැසි*
      `.trim();

      try {
        await conn.sendMessage(from, {
          document: { url: videoUrl },
          mimetype: "video/mp4",
          fileName: `${title.replace(/[^\w\s\-()]/g, "").trim()}.mp4`,
          caption
        }, { quoted: mek });
      } catch {
        await conn.sendMessage(from, {
          text: `⚠️ *Could not send file directly.*\n\n🔗 *Video URL:*\n${videoUrl}`
        }, { quoted: mek });
      }

      if (subtUrl) {
        await conn.sendMessage(from, {
          document: { url: subtUrl },
          mimetype: "text/plain",
          fileName: `${title.replace(/[^\w\s\-()]/g, "").trim()}_sinhala.srt`,
          caption: "💬 *Sinhala Subtitle File (.srt)*"
        }, { quoted: mek });
      }
      return;
    }

    // Embed only fallback
    return await conn.sendMessage(from, {
      text: `⚠️ *Direct download unavailable.*\n\n🔗 *Watch/Download:*\n${embedUrl}\n\n💡 Open in browser to download.`
    }, { quoted: mek });

  } catch (e) {
    console.error("cplayer Error:", e);
    reply("❌ Player command failed. Please try again.");
  }
});


// ══════════════════════════════════════════
//  CMD 4 — TV EPISODES
//  .cepisodes <url>
//  Lists all seasons and episodes of a TV series
// ══════════════════════════════════════════
cmd({
  pattern: "cepisodes",
  alias: ["ceps", "cineeps", "cseasons"],
  desc: "📺 List seasons & episodes of a CineSubz TV series",
  category: "downloader",
  react: "📺",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply(
      `❗ *Usage:* .cepisodes <series_url>\n\n` +
      `*Example:*\n` +
      `▸ .cepisodes https://cinesubz.lk/tv-series/...\n\n` +
      `💡 Get the URL from *.cdetails* or *.csearch*`
    );

    const url = q.trim();
    if (!url.startsWith("http")) return reply("❌ Please provide a valid URL starting with https://");

    await reply(`⏳ *Loading seasons...*\n🔗 ${truncate(url, 50)}`);

    const cancel = sendDelayedUpdate(
      conn, from, mek,
      "⏳ *Still loading seasons... CineSubz is responding slowly.*",
      15000
    );

    let epData;
    try {
      epData = await safeGet(API.episodes(url));
      cancel();
    } catch (err) {
      cancel();
      return await conn.sendMessage(from, {
        text: err.code === "ECONNABORTED"
          ? "⏳ *Timed out loading seasons. Please try again.*"
          : `❌ *Error:* ${err.message}`
      }, { quoted: mek });
    }

    const seasons = epData?.seasons || [];
    if (!seasons.length) return reply("❌ No seasons found for this series.");

    // Show full season/episode list as text
    let text = `📺 *${epData.title || "TV Series"}*\n`;
    text += `${"▬".repeat(20)}\n`;
    text += `🗂 *${seasons.length} Season(s) Available*\n\n`;

    seasons.forEach((s, si) => {
      text += `📂 *${s.season || `Season ${si + 1}`}* — ${s.episodes?.length || 0} episodes\n`;
      (s.episodes || []).slice(0, 5).forEach((ep, ei) => {
        text += `   ${ei + 1}. ${truncate(ep.title || ep.episode || "Episode", 35)}\n`;
        text += `      🔗 \`${ep.url}\`\n`;
      });
      if ((s.episodes?.length || 0) > 5) {
        text += `   ... and ${s.episodes.length - 5} more episodes\n`;
      }
      text += "\n";
    });

    text += `${"▬".repeat(20)}\n`;
    text += `💡 Use *.cepisode <url>* to download an episode`;

    // Also show buttons for seasons (max 3)
    const buttons = seasons.slice(0, 3).map((s, i) => ({
      buttonId: encodeBtn("cine_season", {
        episodes: s.episodes,
        season:   s.season || `Season ${i + 1}`,
        title:    truncate(epData.title || "Series", 22),
        page: 0
      }),
      buttonText: { displayText: `📂 ${s.season || `Season ${i + 1}`} — ${s.episodes?.length || 0} eps` },
      type: 1
    }));

    return await conn.sendMessage(from, {
      text,
      footer: "📺 CineSubz v3 | .cepisodes",
      buttons
    }, { quoted: mek });

  } catch (e) {
    console.error("cepisodes Error:", e);
    reply("❌ Failed to load episodes. Please try again.");
  }
});


// ══════════════════════════════════════════
//  CMD 5 — SINGLE EPISODE
//  .cepisode <episode_url>
//  Resolves and downloads a single episode
// ══════════════════════════════════════════
cmd({
  pattern: "cepisode",
  alias: ["cep", "cineepisode", "cepdown"],
  desc: "🎞 Resolve and download a single TV episode",
  category: "downloader",
  react: "🎞",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply(
      `❗ *Usage:* .cepisode <episode_url>\n\n` +
      `*Example:*\n` +
      `▸ .cepisode https://cinesubz.lk/episodes/...\n\n` +
      `💡 Get episode URLs from *.cepisodes <series_url>*`
    );

    const url = q.trim();
    if (!url.startsWith("http")) return reply("❌ Please provide a valid URL starting with https://");

    await reply(`⏳ *Resolving episode...*\n🔗 ${truncate(url, 50)}`);

    const cancel = sendDelayedUpdate(
      conn, from, mek,
      "⏳ *Still resolving episode... please wait.*",
      15000
    );

    let ep;
    try {
      ep = await safeGet(API.episode(url));
      cancel();
    } catch (err) {
      cancel();
      return await conn.sendMessage(from, {
        text: err.code === "ECONNABORTED"
          ? "⏳ *Timed out resolving episode. Please try again.*"
          : `❌ *Error:* ${err.message}`
      }, { quoted: mek });
    }

    if (!ep) return reply("❌ Could not resolve episode.");

    const players   = ep.players   || [];
    const downloads = ep.downloads || [];
    const fallbackId = ep.post_id  || ep.id;
    const epTitle   = ep.title     || "Episode";

    let text = `╔${"═".repeat(24)}╗\n`;
    text += `  🎞 *Episode Resolved*\n`;
    text += `╚${"═".repeat(24)}╝\n\n`;
    text += `📺 *Title:* ${epTitle}\n`;
    text += `🆔 *Post ID:* \`${fallbackId || "N/A"}\`\n`;
    text += `${"▬".repeat(20)}\n\n`;

    if (downloads.length) {
      text += `*📥 Download Options:*\n`;
      downloads.forEach((dl, i) => {
        text += `${i + 1}. ${dl.quality} (${dl.type})\n`;
        text += `   🔗 \`${dl.url}\`\n`;
      });
      text += `\n👇 *Select quality:*`;
    } else if (players.length) {
      text += `*▶️ Players Available:*\n`;
      players.forEach(p => {
        text += `▸ ${p.name} → *.cplayer ${p.post} ${p.nume}*\n`;
      });
      text += `\n👇 *Or click below:*`;
    } else if (fallbackId) {
      text += `💡 Use: *.cplayer ${fallbackId} 1*\n\n`;
      text += `👇 *Or click below:*`;
    } else {
      text += "❌ *No download options found.*";
    }

    const buttons = [];

    if (downloads.length) {
      downloads.slice(0, 3).forEach(dl => {
        buttons.push({
          buttonId: encodeBtn("cine_download", {
            dlUrl:   dl.url,
            quality: dl.quality,
            title:   truncate(epTitle, 24)
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
            title: truncate(epTitle, 24)
          }),
          buttonText: { displayText: `▶️ ${p.name || `Player ${p.nume}`}` },
          type: 1
        });
      });
    } else if (fallbackId) {
      buttons.push({
        buttonId: encodeBtn("cine_play", { post: fallbackId, nume: "1", title: truncate(epTitle, 24) }),
        buttonText: { displayText: "▶️ Player 01" },
        type: 1
      });
      buttons.push({
        buttonId: encodeBtn("cine_play", { post: fallbackId, nume: "2", title: truncate(epTitle, 24) }),
        buttonText: { displayText: "▶️ Player 02" },
        type: 1
      });
    }

    return await conn.sendMessage(from, {
      text,
      footer: "🎞 CineSubz v3 | .cepisode",
      buttons
    }, { quoted: mek });

  } catch (e) {
    console.error("cepisode Error:", e);
    reply("❌ Failed to resolve episode. Please try again.");
  }
});


// ══════════════════════════════════════════
//  BUTTON HANDLER
//  Handles all button interactions from above commands
// ══════════════════════════════════════════
cmd({
  buttonHandler: async (conn, mek, btnId) => {
    const remoteJid = mek.key.remoteJid;
    const decoded = decodeBtn(btnId);
    if (!decoded) return;
    const { prefix, payload } = decoded;

    try {

      // ── Details button (from search results) ──
      if (prefix === "cine_details") {
        const { post_id, url, title, thumbnail, year, imdb, runtime, genres, type } = payload;
        const isTv = type === "tv";

        // Show instant card from search data
        let quickText = `╔${"═".repeat(24)}╗\n  🎬 *${truncate(title, 28)}*\n╚${"═".repeat(24)}╝\n\n`;
        quickText += `${isTv ? "📺 *TV Series*" : "🎥 *Movie*"}\n`;
        quickText += `📅 ${year || "N/A"} • ⭐ ${stars(imdb)} • ⏱ ${runtime || "N/A"}\n`;
        quickText += `🎭 ${genres || "N/A"}\n`;
        quickText += `🆔 Post ID: \`${post_id}\`\n\n⏳ *Loading full details...*`;

        if (thumbnail) {
          await conn.sendMessage(remoteJid, {
            image: { url: thumbnail },
            caption: quickText,
            footer: "🎬 CineSubz v3"
          }, { quoted: mek });
        } else {
          await conn.sendMessage(remoteJid, { text: quickText }, { quoted: mek });
        }

        // Fetch full details
        const cancel = sendDelayedUpdate(conn, remoteJid, mek, "⏳ *Still loading full details...*", 15000);

        let d = null;
        try {
          d = await safeGet(API.details(url));
          cancel();
          userLastDetails[remoteJid] = d;
        } catch {
          cancel();
          d = null;
          await conn.sendMessage(remoteJid, {
            text: `⚠️ *Full details unavailable (server slow).*\nShowing download options from cache.\n\n💡 You can also use:\n*.cplayer ${post_id} 1*`
          }, { quoted: mek });
        }

        // Build full card
        let text = `╔${"═".repeat(24)}╗\n  🎬 *${d?.title || title}*\n╚${"═".repeat(24)}╝\n\n`;
        text += `${isTv ? "📺 *TV Series*" : "🎥 *Movie*"}\n`;
        text += `📅 *Year:* ${d?.year || year || "N/A"}\n`;
        text += `⭐ *IMDb:* ${stars(d?.imdb || imdb)}\n`;
        if (d?.site_rating) text += `🌟 *Site:* ${d.site_rating} (${d.site_rating_count || ""})\n`;
        text += `⏱ *Runtime:* ${d?.runtime || runtime || "N/A"}\n`;
        text += `🌐 *Lang:* ${d?.country || "N/A"}\n`;
        text += `🎭 *Genres:* ${Array.isArray(d?.genres) ? d.genres.join(", ") : (genres || "N/A")}\n`;
        if (d?.director)    text += `🎬 *Director:* ${d.director}\n`;
        if (d?.quality)     text += `🎞 *Quality:* ${d.quality}\n`;
        if (d?.subtitle_by) text += `💬 *Subs by:* ${d.subtitle_by}\n`;
        text += `🆔 *Post ID:* \`${d?.post_id || post_id}\`\n`;
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
          text += "👇 *Select Quality:*";
          const direct = downloads.filter(x => x.type?.toLowerCase().includes("direct"));
          const tg     = downloads.filter(x => x.type?.toLowerCase().includes("telegram"));
          const show   = (direct.length ? direct : tg).slice(0, 3);
          show.forEach(dl => {
            buttons.push({
              buttonId: encodeBtn("cine_download", { dlUrl: dl.url, quality: dl.quality, title: truncate(d?.title || title, 24) }),
              buttonText: { displayText: `⬇️ ${truncate(dl.quality, 30)}` },
              type: 1
            });
          });
          if (direct.length && tg.length && buttons.length < 3) {
            buttons.push({
              buttonId: encodeBtn("cine_dl_tg", { downloads: tg, title: truncate(d?.title || title, 24) }),
              buttonText: { displayText: "📲 Telegram Links" },
              type: 1
            });
          }
        } else if (players.length) {
          text += "👇 *Select Player:*";
          players.slice(0, 3).forEach(p => {
            buttons.push({
              buttonId: encodeBtn("cine_play", { post: p.post || post_id, nume: p.nume, title: truncate(d?.title || title, 24) }),
              buttonText: { displayText: `▶️ ${p.name || `Player ${p.nume}`}` },
              type: 1
            });
          });
        } else {
          // Fallback
          text += "👇 *Try players:*";
          buttons.push({
            buttonId: encodeBtn("cine_play", { post: post_id, nume: "1", title: truncate(d?.title || title, 24) }),
            buttonText: { displayText: "▶️ Player 01" },
            type: 1
          });
          buttons.push({
            buttonId: encodeBtn("cine_play", { post: post_id, nume: "2", title: truncate(d?.title || title, 24) }),
            buttonText: { displayText: "▶️ Player 02" },
            type: 1
          });
        }

        const poster = d?.poster || d?.thumbnail || thumbnail;
        if (poster) {
          return await conn.sendMessage(remoteJid, {
            image: { url: poster }, caption: text, footer: "🎬 CineSubz v3", buttons, headerType: 4
          }, { quoted: mek });
        }
        return await conn.sendMessage(remoteJid, { text, footer: "🎬 CineSubz v3", buttons }, { quoted: mek });
      }

      // ── Download button ──
      if (prefix === "cine_download") {
        const { dlUrl, quality, title } = payload;
        await conn.sendMessage(remoteJid, { text: `⏳ *Sending:* _${title}_\n🎞 ${quality}` }, { quoted: mek });
        const cancel = sendDelayedUpdate(conn, remoteJid, mek, "⏳ *Still uploading... Large files take time.*", 20000);
        const caption = `🎬 *${title}*\n🎞 *Quality:* ${quality}\n💬 Sinhala Subtitles\n✅ CineSubz v3`;
        try {
          await conn.sendMessage(remoteJid, {
            document: { url: dlUrl }, mimetype: "video/mp4",
            fileName: `${title.replace(/[^\w\s\-()]/g, "").trim()}.mp4`, caption
          }, { quoted: mek });
          cancel();
        } catch {
          cancel();
          await conn.sendMessage(remoteJid, { text: `⚠️ *Could not auto-send.*\n\n🔗 *Link:*\n${dlUrl}` }, { quoted: mek });
        }
        return;
      }

      // ── Telegram links button ──
      if (prefix === "cine_dl_tg") {
        const { downloads, title } = payload;
        let text = `📲 *Telegram Links*\n🎬 *${title}*\n${"▬".repeat(20)}\n\n`;
        downloads.forEach((dl, i) => { text += `*${i + 1}.* ${dl.quality}\n🔗 ${dl.url}\n\n`; });
        text += "💡 Open in Telegram or browser.";
        return await conn.sendMessage(remoteJid, { text }, { quoted: mek });
      }

      // ── Player button ──
      if (prefix === "cine_play") {
        const { post, nume, title } = payload;
        await conn.sendMessage(remoteJid, { text: `⏳ *Fetching player ${nume}...*\n🎬 _${title}_` }, { quoted: mek });
        const cancel = sendDelayedUpdate(conn, remoteJid, mek, "⏳ *Still resolving video...*", 15000);
        let pd;
        try {
          pd = await safeGet(API.player(post, nume));
          cancel();
        } catch (err) {
          cancel();
          return await conn.sendMessage(remoteJid, {
            text: err.code === "ECONNABORTED" ? "⏳ *Player timed out. Try again.*" : `❌ ${err.message}`
          }, { quoted: mek });
        }
        if (!pd) return await conn.sendMessage(remoteJid, { text: "❌ Player returned no data." }, { quoted: mek });

        const videoUrl = pd.video_url || pd.raw_url  || null;
        const embedUrl = pd.raw_embed || pd.iframe_url || null;
        const subtUrl  = pd.subtitle_url || null;
        const vidType  = pd.video_type   || "mp4";

        if (!videoUrl && !embedUrl) {
          return await conn.sendMessage(remoteJid, { text: `❌ No video link found.\n\`${JSON.stringify(pd).slice(0, 300)}\`` }, { quoted: mek });
        }
        if (videoUrl) {
          const caption = `🎬 *${title}*\n🎞 ${vidType.toUpperCase()} | Player ${nume}\n💬 ${subtUrl ? "✅ Sinhala Subs" : "❌ No Subs"}\n✅ CineSubz v3`;
          try {
            await conn.sendMessage(remoteJid, {
              document: { url: videoUrl }, mimetype: "video/mp4",
              fileName: `${title.replace(/[^\w\s\-()]/g, "").trim()}.mp4`, caption
            }, { quoted: mek });
          } catch {
            await conn.sendMessage(remoteJid, { text: `⚠️ *Could not send file.*\n\n🔗 ${videoUrl}` }, { quoted: mek });
          }
          if (subtUrl) {
            await conn.sendMessage(remoteJid, {
              document: { url: subtUrl }, mimetype: "text/plain",
              fileName: `${title.replace(/[^\w\s\-()]/g, "").trim()}_sinhala.srt`,
              caption: "💬 *Sinhala Subtitle (.srt)*"
            }, { quoted: mek });
          }
          return;
        }
        return await conn.sendMessage(remoteJid, {
          text: `⚠️ *Direct download unavailable.*\n\n🔗 *Watch:*\n${embedUrl}\n\n💡 Open in browser.`
        }, { quoted: mek });
      }

      // ── Season button ──
      if (prefix === "cine_season") {
        const { episodes = [], season, title, page = 0 } = payload;
        if (!episodes.length) return await conn.sendMessage(remoteJid, { text: "❌ No episodes found." }, { quoted: mek });
        const PAGE = 2;
        const start = page * PAGE;
        const slice = episodes.slice(start, start + PAGE);
        const hasMore = start + PAGE < episodes.length;
        let text = `📺 *${title}*\n📂 *${season}*\n${"▬".repeat(20)}\n🎞 ${episodes.length} eps • Page ${page + 1}\n\n👇 Select episode:`;
        const buttons = slice.map(ep => ({
          buttonId: encodeBtn("cine_episode_btn", {
            epUrl: ep.url, epTitle: truncate(ep.title || ep.episode || "Episode", 22), showTitle: title
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
        return await conn.sendMessage(remoteJid, { text, footer: `📂 ${season} • CineSubz v3`, buttons }, { quoted: mek });
      }

      // ── Episodes season list button ──
      if (prefix === "cine_episodes") {
        const { url, title } = payload;
        await conn.sendMessage(remoteJid, { text: `⏳ *Loading seasons...*\n📺 _${title}_` }, { quoted: mek });
        const cancel = sendDelayedUpdate(conn, remoteJid, mek, "⏳ *Still loading seasons...*", 15000);
        let epData;
        try { epData = await safeGet(API.episodes(url)); cancel(); }
        catch (err) { cancel(); return await conn.sendMessage(remoteJid, { text: `❌ ${err.message}` }, { quoted: mek }); }
        const seasons = epData?.seasons || [];
        if (!seasons.length) return await conn.sendMessage(remoteJid, { text: "❌ No seasons found." }, { quoted: mek });
        let text = `📺 *${title}*\n${"▬".repeat(20)}\n🗂 ${seasons.length} Season(s)\n\n👇 Select season:`;
        const buttons = seasons.slice(0, 3).map((s, i) => ({
          buttonId: encodeBtn("cine_season", { episodes: s.episodes, season: s.season || `Season ${i + 1}`, title: truncate(title, 22), page: 0 }),
          buttonText: { displayText: `📂 ${s.season || `Season ${i + 1}`} — ${s.episodes?.length || 0} eps` },
          type: 1
        }));
        return await conn.sendMessage(remoteJid, { text, footer: "📺 CineSubz v3", buttons }, { quoted: mek });
      }

      // ── Episode resolve button ──
      if (prefix === "cine_episode_btn") {
        const { epUrl, epTitle, showTitle } = payload;
        await conn.sendMessage(remoteJid, { text: `⏳ *Resolving:* _${epTitle}_...` }, { quoted: mek });
        const cancel = sendDelayedUpdate(conn, remoteJid, mek, "⏳ *Still resolving episode...*", 15000);
        let ep;
        try { ep = await safeGet(API.episode(epUrl)); cancel(); }
        catch (err) { cancel(); return await conn.sendMessage(remoteJid, { text: `❌ ${err.message}` }, { quoted: mek }); }
        if (!ep) return await conn.sendMessage(remoteJid, { text: "❌ Could not resolve episode." }, { quoted: mek });
        const players = ep.players || []; const downloads = ep.downloads || []; const fallbackId = ep.post_id || ep.id;
        let text = `📺 *${showTitle}*\n🎞 *${epTitle}*\n${"▬".repeat(20)}\n👇 Select quality:`;
        const buttons = [];
        if (downloads.length) {
          downloads.slice(0, 3).forEach(dl => buttons.push({
            buttonId: encodeBtn("cine_download", { dlUrl: dl.url, quality: dl.quality, title: `${showTitle} - ${epTitle}` }),
            buttonText: { displayText: `⬇️ ${truncate(dl.quality, 30)}` }, type: 1
          }));
        } else if (players.length) {
          players.slice(0, 3).forEach(p => buttons.push({
            buttonId: encodeBtn("cine_play", { post: p.post, nume: p.nume, title: `${showTitle} - ${epTitle}` }),
            buttonText: { displayText: `▶️ ${p.name || `Player ${p.nume}`}` }, type: 1
          }));
        } else if (fallbackId) {
          buttons.push({ buttonId: encodeBtn("cine_play", { post: fallbackId, nume: "1", title: `${showTitle} - ${epTitle}` }), buttonText: { displayText: "▶️ Player 01" }, type: 1 });
          buttons.push({ buttonId: encodeBtn("cine_play", { post: fallbackId, nume: "2", title: `${showTitle} - ${epTitle}` }), buttonText: { displayText: "▶️ Player 02" }, type: 1 });
        } else { text += "\n\n❌ *No options found.*"; }
        return await conn.sendMessage(remoteJid, { text, footer: "📺 CineSubz v3", buttons }, { quoted: mek });
      }

    } catch (err) {
      console.error("CineSubz Button Error:", err);
      await conn.sendMessage(remoteJid, {
        text: err.code === "ECONNABORTED" ? "⏳ *Timed out. Please try again.*" : `❌ \`${err.message}\``
      }, { quoted: mek });
    }
  }
});
