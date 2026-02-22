require("dotenv").config();

const { cmd } = require("../command");
const axios = require("axios");

// ================== CONFIG ==================
const CINE_BASE = process.env.CINESUBZ_BASE || "https://cinesubz-v3.vercel.app";

const API = {
  search:   (q)        => `${CINE_BASE}/api/search?q=${encodeURIComponent(q)}`,
  details:  (url)      => `${CINE_BASE}/api/details?url=${encodeURIComponent(url)}`,
  player:   (post, n)  => `${CINE_BASE}/api/player?post=${post}&nume=${n}`,
  episodes: (url)      => `${CINE_BASE}/api/tv/episodes?url=${encodeURIComponent(url)}`,
  episode:  (url)      => `${CINE_BASE}/api/tv/episode?url=${encodeURIComponent(url)}`
};

// ================== HELPERS ==================
async function safeGet(url) {
  const { data } = await axios.get(url, { timeout: 300000 }); // 5 min
  return data;
}

function truncate(str = "", len = 30) {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

// Safe base64url encode/decode for buttonIds
function encodeBtn(prefix, payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${prefix}::${encoded}`;
}

function decodeBtn(btnId) {
  const sep = btnId.indexOf("::");
  if (sep === -1) return null;
  const prefix = btnId.slice(0, sep);
  try {
    const payload = JSON.parse(Buffer.from(btnId.slice(sep + 2), "base64url").toString("utf8"));
    return { prefix, payload };
  } catch { return null; }
}

function stars(rating) {
  const n = parseFloat(rating);
  if (isNaN(n)) return "N/A";
  const filled = Math.round(n / 2);
  return "⭐".repeat(filled) + "☆".repeat(5 - filled) + ` (${rating}/10)`;
}

// ==============================
//  SEARCH COMMAND
//  .movie <query>
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
    if (!q) return reply(`❗ *Usage:* .movie <title>\n\n*Example:* .movie Avatar`);

    await reply("🔍 *Searching CineSubz...*");

    const data = await safeGet(API.search(q));

    // API returns { query, count, results: [...] }
    const results = data?.results || data;

    if (!results || !results.length) {
      return reply("❌ *No results found.*\nTry a different keyword.");
    }

    const top = results.slice(0, 5);

    let text = `🎬 *CineSubz Search Results*\n`;
    text += `🔎 *"${q}"* — ${data.count || top.length} found\n`;
    text += `${"▬".repeat(20)}\n\n`;

    top.forEach((r, i) => {
      const icon = r.type === "tv" ? "📺" : "🎥";
      text += `*${i + 1}.* ${icon} *${r.title}*\n`;
      text += `   📅 ${r.year || "N/A"} • ⭐ ${r.imdb || "N/A"} • ⏱ ${r.runtime || "N/A"}\n`;
      text += `   🎭 ${truncate(r.genres || "N/A", 35)}\n\n`;
    });

    text += `${"▬".repeat(20)}\n👇 *Select a title:*`;

    const buttons = top.map((r, i) => ({
      buttonId: encodeBtn("cine_details", {
        url:   r.url,
        title: truncate(r.title, 22),
        type:  r.type || "movie"
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
      // DETAILS  →  show info + players/downloads as buttons
      // Real API: players:[{nume,post,type,name}], downloads:[{url,quality,type}]
      // ────────────────────────────────
      if (prefix === "cine_details") {
        const { url, title, type } = payload;

        await conn.sendMessage(remoteJid, {
          text: `⏳ *Loading:* _${title}_...`
        }, { quoted: mek });

        const d = await safeGet(API.details(url));
        if (!d) return await conn.sendMessage(remoteJid, { text: "❌ Could not load details." }, { quoted: mek });

        const isTv = type === "tv" || d.type === "tv";

        // ── Build info card ──
        let text = `╔${"═".repeat(24)}╗\n`;
        text += `  🎬 *${d.title || title}*\n`;
        text += `╚${"═".repeat(24)}╝\n\n`;
        text += `${isTv ? "📺 *TV Series*" : "🎥 *Movie*"}\n`;
        text += `📅 *Year:* ${d.year || "N/A"}\n`;
        text += `⭐ *IMDb:* ${stars(d.imdb)}\n`;
        text += `🌟 *Site Rating:* ${d.site_rating || "N/A"} (${d.site_rating_count || ""})\n`;
        text += `⏱ *Runtime:* ${d.runtime || "N/A"}\n`;
        text += `🌐 *Country/Lang:* ${d.country || "N/A"}\n`;
        text += `🎭 *Genres:* ${Array.isArray(d.genres) ? d.genres.join(", ") : "N/A"}\n`;
        text += `🎬 *Director:* ${d.director || "N/A"}\n`;
        text += `🎞 *Quality:* ${d.quality || "N/A"}\n`;
        if (d.subtitle_by) text += `💬 *Subs by:* ${d.subtitle_by}\n`;
        if (d.tagline) text += `\n💬 _${d.tagline}_\n`;
        text += `\n📝 *Synopsis:*\n${(d.description || "N/A").slice(0, 350)}...\n`;
        text += `\n${"▬".repeat(20)}\n`;

        const buttons = [];

        if (isTv) {
          // TV Series → browse episodes
          text += "👇 *Browse Episodes:*";
          buttons.push({
            buttonId: encodeBtn("cine_episodes", { url, title: truncate(d.title || title, 22) }),
            buttonText: { displayText: "📺 Browse Seasons & Episodes" },
            type: 1
          });
        } else {
          // Movie → show Download buttons (from downloads array)
          // downloads: [{url, quality, type}]
          const downloads = d.downloads || [];
          const players   = d.players   || [];

          if (downloads.length) {
            text += "👇 *Select Quality to Download:*";
            // Group by type (Direct / Telegram) — show Direct first, max 3 buttons
            const direct = downloads.filter(x => x.type?.toLowerCase().includes("direct")).slice(0, 3);
            const tg     = downloads.filter(x => x.type?.toLowerCase().includes("telegram")).slice(0, 3);
            const show   = direct.length ? direct : tg;

            show.forEach(dl => {
              buttons.push({
                buttonId: encodeBtn("cine_download", {
                  dlUrl: dl.url,
                  quality: dl.quality,
                  title: truncate(d.title || title, 24)
                }),
                buttonText: { displayText: `⬇️ ${truncate(dl.quality, 30)}` },
                type: 1
              });
            });

            // If both types exist, add a "Telegram Links" toggle button
            if (direct.length && tg.length && buttons.length < 3) {
              buttons.push({
                buttonId: encodeBtn("cine_dl_tg", {
                  downloads: tg,
                  title: truncate(d.title || title, 24)
                }),
                buttonText: { displayText: "📲 Telegram Download Links" },
                type: 1
              });
            }

          } else if (players.length) {
            // Fallback to player API
            text += "👇 *Select Player:*";
            players.slice(0, 3).forEach(p => {
              buttons.push({
                buttonId: encodeBtn("cine_play", {
                  post: p.post,
                  nume: p.nume,
                  title: truncate(d.title || title, 24)
                }),
                buttonText: { displayText: `▶️ ${p.name || `Player ${p.nume}`}` },
                type: 1
              });
            });
          } else {
            text += "❌ *No download options found.*";
          }
        }

        const poster = d.poster || d.thumbnail || d.image;
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
      // DIRECT DOWNLOAD — send as document
      // ────────────────────────────────
      if (prefix === "cine_download") {
        const { dlUrl, quality, title } = payload;

        await conn.sendMessage(remoteJid, {
          text: `⏳ *Sending:* _${title}_\n🎞 *Quality:* ${quality}\n\nPlease wait...`
        }, { quoted: mek });

        const caption = `
╔${"═".repeat(24)}╗
  🎬 *${title}*
╚${"═".repeat(24)}╝

🎞 *Quality:* ${quality}
💬 *Subtitles:* Sinhala | සිංහල
${"▬".repeat(20)}
✅ *CineSubz v3 | සිංහල උපසිරැසි*
        `.trim();

        await conn.sendMessage(remoteJid, {
          document: { url: dlUrl },
          mimetype: "video/mp4",
          fileName: `${title.replace(/[^\w\s\-()]/g, "").trim()}.mp4`,
          caption
        }, { quoted: mek });

        return;
      }


      // ────────────────────────────────
      // TELEGRAM LINKS LIST
      // ────────────────────────────────
      if (prefix === "cine_dl_tg") {
        const { downloads, title } = payload;

        let text = `📲 *Telegram Download Links*\n🎬 *${title}*\n${"▬".repeat(20)}\n\n`;
        downloads.forEach((dl, i) => {
          text += `*${i + 1}.* ${dl.quality}\n🔗 ${dl.url}\n\n`;
        });
        text += "💡 Open links in browser or Telegram to download.";

        return await conn.sendMessage(remoteJid, { text }, { quoted: mek });
      }


      // ────────────────────────────────
      // PLAYER API → fetch video_url
      // ────────────────────────────────
      if (prefix === "cine_play") {
        const { post, nume, title } = payload;

        await conn.sendMessage(remoteJid, {
          text: `⏳ *Fetching player for:* _${title}_...`
        }, { quoted: mek });

        const pd = await safeGet(API.player(post, nume));
        if (!pd) return await conn.sendMessage(remoteJid, { text: "❌ Player returned no data." }, { quoted: mek });

        const videoUrl  = pd.video_url  || pd.raw_url  || null;
        const embedUrl  = pd.raw_embed  || pd.iframe_url || null;
        const subtUrl   = pd.subtitle_url || null;
        const vidType   = pd.video_type  || "mp4";

        if (!videoUrl && !embedUrl) {
          return await conn.sendMessage(remoteJid, {
            text: `❌ Could not extract video.\n\`${JSON.stringify(pd).slice(0, 300)}\``
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

          await conn.sendMessage(remoteJid, {
            document: { url: videoUrl },
            mimetype: "video/mp4",
            fileName: `${title.replace(/[^\w\s\-()]/g, "").trim()}.mp4`,
            caption
          }, { quoted: mek });

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
          text: `🎬 *${title}*\n\n⚠️ *Direct download unavailable.*\n\n🔗 *Watch / Download:*\n${embedUrl}\n\n💡 Open in browser to download.`
        }, { quoted: mek });
      }


      // ────────────────────────────────
      // TV EPISODES — Season list
      // ────────────────────────────────
      if (prefix === "cine_episodes") {
        const { url, title } = payload;

        await conn.sendMessage(remoteJid, {
          text: `⏳ *Loading seasons for:* _${title}_...`
        }, { quoted: mek });

        const epData = await safeGet(API.episodes(url));
        const seasons = epData?.seasons || [];

        if (!seasons.length) {
          return await conn.sendMessage(remoteJid, {
            text: "❌ Could not fetch season list."
          }, { quoted: mek });
        }

        let text = `📺 *${title}*\n${"▬".repeat(20)}\n`;
        text += `🗂 *${seasons.length} Season(s) Available*\n\n👇 Select a season:`;

        const buttons = seasons.slice(0, 3).map((s, i) => ({
          buttonId: encodeBtn("cine_season", {
            episodes: s.episodes,
            season:   s.season || `Season ${i + 1}`,
            title:    truncate(title, 22),
            page: 0
          }),
          buttonText: {
            displayText: `📂 ${s.season || `Season ${i + 1}`} — ${s.episodes?.length || 0} eps`
          },
          type: 1
        }));

        return await conn.sendMessage(remoteJid, {
          text, footer: "📺 CineSubz v3", buttons
        }, { quoted: mek });
      }


      // ────────────────────────────────
      // SEASON → Episode list (paginated)
      // ────────────────────────────────
      if (prefix === "cine_season") {
        const { episodes = [], season, title, page = 0 } = payload;
        if (!episodes.length) return await conn.sendMessage(remoteJid, { text: "❌ No episodes found." }, { quoted: mek });

        const PAGE = 2; // 2 episodes + 1 "More" = max 3 buttons
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
      // SINGLE EPISODE → resolve → player
      // ────────────────────────────────
      if (prefix === "cine_episode") {
        const { epUrl, epTitle, showTitle } = payload;

        await conn.sendMessage(remoteJid, {
          text: `⏳ *Resolving episode:* _${epTitle}_...`
        }, { quoted: mek });

        const ep = await safeGet(API.episode(epUrl));
        if (!ep) return await conn.sendMessage(remoteJid, { text: "❌ Could not resolve episode." }, { quoted: mek });

        const players   = ep.players   || [];
        const downloads = ep.downloads || [];
        const fallbackId = ep.post_id || ep.id;

        let text = `╔${"═".repeat(24)}╗\n`;
        text += `  📺 *${showTitle}*\n`;
        text += `╚${"═".repeat(24)}╝\n\n`;
        text += `🎞 *Episode:* ${epTitle}\n${"▬".repeat(20)}\n👇 Select quality:`;

        const buttons = [];

        if (downloads.length) {
          downloads.slice(0, 3).forEach(dl => {
            buttons.push({
              buttonId: encodeBtn("cine_download", {
                dlUrl:   dl.url,
                quality: dl.quality,
                title:   `${showTitle} - ${epTitle}`
              }),
              buttonText: { displayText: `⬇️ ${truncate(dl.quality, 30)}` },
              type: 1
            });
          });
        } else if (players.length) {
          players.slice(0, 3).forEach(p => {
            buttons.push({
              buttonId: encodeBtn("cine_play", {
                post:  p.post,
                nume:  p.nume,
                title: `${showTitle} - ${epTitle}`
              }),
              buttonText: { displayText: `▶️ ${p.name || `Player ${p.nume}`}` },
              type: 1
            });
          });
        } else if (fallbackId) {
          buttons.push({
            buttonId: encodeBtn("cine_play", { post: fallbackId, nume: "1", title: `${showTitle} - ${epTitle}` }),
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
      const isTimeout = err.code === "ECONNABORTED";
      await conn.sendMessage(remoteJid, {
        text: isTimeout
          ? "⏳ *Timed out (5 min). Server busy. Please try again.*"
          : `❌ Error: \`${err.message}\``
      }, { quoted: mek });
    }
  }
});
