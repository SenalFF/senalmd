require("dotenv").config();

const { cmd } = require("../command");
const axios = require("axios");

// ================== ENV ==================
const CINE_BASE = process.env.CINESUBZ_BASE || "https://cinesubz-v3.vercel.app";

const API = {
  search:   (q)        => `${CINE_BASE}/api/search?q=${encodeURIComponent(q)}`,
  details:  (url)      => `${CINE_BASE}/api/details?url=${encodeURIComponent(url)}`,
  player:   (id, nume) => `${CINE_BASE}/api/player?post=${id}${nume ? `&nume=${encodeURIComponent(nume)}` : ""}`,
  episodes: (url)      => `${CINE_BASE}/api/tv/episodes?url=${encodeURIComponent(url)}`,
  episode:  (url)      => `${CINE_BASE}/api/tv/episode?url=${encodeURIComponent(url)}`
};

const AUDIO_EXTS = ["mp3", "ogg", "webm", "aac", "m4a", "wav"];

// ================== HELPERS ==================
async function safeGet(url) {
  const { data } = await axios.get(url, { timeout: 300000 }); // 5 min timeout
  return data;
}

function truncate(str, len = 30) {
  if (!str) return "Unknown";
  return str.length > len ? str.slice(0, len - 1) + "\u2026" : str;
}

// Encode payload safely into buttonId using base64url
function encodeBtn(prefix, payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${prefix}::${encoded}`;
}

function decodeBtn(btnId) {
  const sep = btnId.indexOf("::");
  if (sep === -1) return null;
  const prefix = btnId.slice(0, sep);
  const encoded = btnId.slice(sep + 2);
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return { prefix, payload };
  } catch {
    return null;
  }
}


// ==============================
// SEARCH COMMAND
// Usage: .movie <name>
// ==============================
cmd({
  pattern: "csub",
  alias: ["film", "cine", "cinema", "series"],
  desc: "CineSubz Movie & TV Downloader",
  category: "downloader",
  react: "🎬",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("❗ Provide a movie or series name.\n*Example:* `.movie RRR`");

    await reply("🔍 *Searching CineSubz... Please wait!*");

    const results = await safeGet(API.search(q));

    if (!results || !results.length) {
      return reply("❌ No results found. Try a different keyword.");
    }

    const top = results.slice(0, 5);

    let text = `🎬 *CineSubz Search Results*\n🔎 Query: *${q}*\n${"─".repeat(28)}\n\n`;
    top.forEach((r, i) => {
      const typeIcon = r.type === "tv" ? "📺" : "🎥";
      text += `*${i + 1}.* ${typeIcon} ${r.title || "Unknown"}`;
      if (r.year) text += ` _(${r.year})_`;
      text += "\n";
    });
    text += `\n${"─".repeat(28)}\n👇 *Select a result:*`;

    const buttons = top.map((r, i) => ({
      buttonId: encodeBtn("cine_details", {
        url: r.url,
        title: truncate(r.title, 20),
        type: r.type || "movie"
      }),
      buttonText: {
        displayText: `${i + 1}. ${truncate(r.title, 22)}${r.year ? ` (${r.year})` : ""}`
      },
      type: 1
    }));

    await conn.sendMessage(from, {
      text,
      footer: "🎬 Powered by CineSubz v3",
      buttons
    }, { quoted: mek });

  } catch (e) {
    console.error("CineSubz Search Error:", e);
    reply("❌ Error while searching. Please try again.");
  }
});


// ==============================
// BUTTON HANDLER
// ==============================
cmd({
  buttonHandler: async (conn, mek, btnId) => {
    const remoteJid = mek.key.remoteJid;

    const decoded = decodeBtn(btnId);
    if (!decoded) return; // not our button

    const { prefix, payload } = decoded;

    try {

      // ──────────────────────────────
      // DETAILS — Show info + action buttons
      // ──────────────────────────────
      if (prefix === "cine_details") {
        const { url, title, type } = payload;

        await conn.sendMessage(remoteJid, {
          text: `⏳ *Loading details for* _${title}_...`
        }, { quoted: mek });

        const details = await safeGet(API.details(url));

        if (!details) {
          return await conn.sendMessage(remoteJid, {
            text: "❌ Could not fetch details."
          }, { quoted: mek });
        }

        const isTv = type === "tv" || details.type === "tv";
        const typeLabel = isTv ? "📺 TV Series" : "🎥 Movie";

        let text = `
╔══════════════════════╗
  🎬 *${details.title || title}*
╚══════════════════════╝

${typeLabel}
📅 *Year:* ${details.year || "N/A"}
⭐ *Rating:* ${details.rating || "N/A"}
🎭 *Genre:* ${Array.isArray(details.genres) ? details.genres.join(", ") : (details.genre || "N/A")}
🌐 *Language:* ${details.language || "N/A"}
${details.quality ? `🎞 *Quality:* ${details.quality}` : ""}

📝 *Synopsis:*
${(details.description || details.synopsis || "No description available.").slice(0, 400)}

${"─".repeat(28)}
${isTv ? "👇 *Browse episodes below:*" : "👇 *Download below:*"}
        `.trim();

        const buttons = [];

        if (isTv) {
          buttons.push({
            buttonId: encodeBtn("cine_episodes", {
              url,
              title: truncate(details.title || title, 20)
            }),
            buttonText: { displayText: "📺 Browse Seasons & Episodes" },
            type: 1
          });
        } else {
          // Movie: build download buttons from player_ids
          const playerIds = details.player_ids || details.players || [];

          if (playerIds.length) {
            playerIds.slice(0, 3).forEach((p, i) => {
              const label = p.label || p.name || `Option ${i + 1}`;
              const id = p.id || p.post_id || p;
              const nume = p.nume || p.num || "";
              buttons.push({
                buttonId: encodeBtn("cine_play", {
                  id, nume,
                  title: truncate(details.title || title, 24)
                }),
                buttonText: { displayText: `⬇️ Download — ${label}` },
                type: 1
              });
            });
          } else {
            const id = details.post_id || details.id;
            if (id) {
              buttons.push({
                buttonId: encodeBtn("cine_play", {
                  id, nume: "",
                  title: truncate(details.title || title, 24)
                }),
                buttonText: { displayText: "⬇️ Download Movie" },
                type: 1
              });
            } else {
              text += "\n\n❌ *No download options found.*";
            }
          }
        }

        const msgPayload = {
          text,
          footer: "🎬 CineSubz v3",
          buttons
        };

        // If poster image available, send as image message
        const poster = details.poster || details.thumbnail || details.image;
        if (poster) {
          return await conn.sendMessage(remoteJid, {
            image: { url: poster },
            caption: text,
            footer: "🎬 CineSubz v3",
            buttons,
            headerType: 4
          }, { quoted: mek });
        }

        return await conn.sendMessage(remoteJid, msgPayload, { quoted: mek });
      }


      // ──────────────────────────────
      // TV EPISODES — Season list
      // ──────────────────────────────
      if (prefix === "cine_episodes") {
        const { url, title } = payload;

        await conn.sendMessage(remoteJid, {
          text: `⏳ *Loading seasons for* _${title}_...`
        }, { quoted: mek });

        const epData = await safeGet(API.episodes(url));

        if (!epData || !epData.seasons || !epData.seasons.length) {
          return await conn.sendMessage(remoteJid, {
            text: "❌ Could not fetch episode list."
          }, { quoted: mek });
        }

        const { seasons } = epData;

        let text = `
📺 *${title}*
${"─".repeat(28)}
🗂 *${seasons.length} Season(s) Available*

👇 Select a season:
        `.trim();

        const buttons = seasons.slice(0, 3).map((s, i) => ({
          buttonId: encodeBtn("cine_season", {
            episodes: s.episodes,
            season: s.season || `Season ${i + 1}`,
            title: truncate(title, 20),
            page: 0
          }),
          buttonText: {
            displayText: `📂 ${s.season || `Season ${i + 1}`} — ${s.episodes?.length || 0} eps`
          },
          type: 1
        }));

        return await conn.sendMessage(remoteJid, {
          text,
          footer: "📺 CineSubz v3",
          buttons
        }, { quoted: mek });
      }


      // ──────────────────────────────
      // SEASON — Episode list (paginated, max 3 buttons)
      // ──────────────────────────────
      if (prefix === "cine_season") {
        const { episodes, season, title, page = 0 } = payload;

        if (!episodes || !episodes.length) {
          return await conn.sendMessage(remoteJid, {
            text: "❌ No episodes found for this season."
          }, { quoted: mek });
        }

        const PAGE_SIZE = 2; // 2 episodes + 1 "More" button = 3 max
        const start = page * PAGE_SIZE;
        const slice = episodes.slice(start, start + PAGE_SIZE);
        const hasMore = start + PAGE_SIZE < episodes.length;

        let text = `
📺 *${title}*
📂 *${season}*
${"─".repeat(28)}
🎞 *${episodes.length} Episode(s)* | Page ${page + 1}

👇 Select an episode:
        `.trim();

        const buttons = slice.map((ep) => ({
          buttonId: encodeBtn("cine_episode", {
            epUrl: ep.url,
            epTitle: truncate(ep.title || ep.episode || "Episode", 22),
            showTitle: title
          }),
          buttonText: {
            displayText: `▶️ ${truncate(ep.title || ep.episode || "Episode", 28)}`
          },
          type: 1
        }));

        if (hasMore) {
          buttons.push({
            buttonId: encodeBtn("cine_season", {
              episodes,
              season,
              title,
              page: page + 1
            }),
            buttonText: {
              displayText: `⏭ More Episodes (${start + PAGE_SIZE + 1}–${Math.min(start + PAGE_SIZE * 2, episodes.length)})`
            },
            type: 1
          });
        }

        return await conn.sendMessage(remoteJid, {
          text,
          footer: `📂 ${season} • CineSubz v3`,
          buttons
        }, { quoted: mek });
      }


      // ──────────────────────────────
      // EPISODE — Resolve single episode → player
      // ──────────────────────────────
      if (prefix === "cine_episode") {
        const { epUrl, epTitle, showTitle } = payload;

        await conn.sendMessage(remoteJid, {
          text: `⏳ *Resolving episode:* _${epTitle}_...`
        }, { quoted: mek });

        const epData = await safeGet(API.episode(epUrl));

        if (!epData) {
          return await conn.sendMessage(remoteJid, {
            text: "❌ Could not resolve episode."
          }, { quoted: mek });
        }

        const playerIds = epData.player_ids || epData.players || [];
        const fallbackId = epData.post_id || epData.id;

        if (!playerIds.length && !fallbackId) {
          return await conn.sendMessage(remoteJid, {
            text: "❌ No download options found for this episode."
          }, { quoted: mek });
        }

        let text = `
╔══════════════════════╗
  📺 *${showTitle}*
╚══════════════════════╝

🎞 *Episode:* ${epTitle}
${"─".repeat(28)}
👇 Select download quality:
        `.trim();

        const buttons = [];

        if (playerIds.length) {
          playerIds.slice(0, 3).forEach((p, i) => {
            const label = p.label || p.name || `Option ${i + 1}`;
            const id = p.id || p.post_id || p;
            const nume = p.nume || p.num || "";
            buttons.push({
              buttonId: encodeBtn("cine_play", {
                id, nume,
                title: `${showTitle} — ${epTitle}`
              }),
              buttonText: { displayText: `⬇️ ${label}` },
              type: 1
            });
          });
        } else {
          buttons.push({
            buttonId: encodeBtn("cine_play", {
              id: fallbackId,
              nume: "",
              title: `${showTitle} — ${epTitle}`
            }),
            buttonText: { displayText: "⬇️ Download Episode" },
            type: 1
          });
        }

        return await conn.sendMessage(remoteJid, {
          text,
          footer: "📺 CineSubz v3",
          buttons
        }, { quoted: mek });
      }


      // ──────────────────────────────
      // PLAY — Fetch from player API and send video
      // ──────────────────────────────
      if (prefix === "cine_play") {
        const { id, nume, title } = payload;

        await conn.sendMessage(remoteJid, {
          text: `⏳ *Fetching video for:*\n🎬 _${title}_\n\nThis may take a moment...`
        }, { quoted: mek });

        const playerData = await safeGet(API.player(id, nume));

        if (!playerData) {
          return await conn.sendMessage(remoteJid, {
            text: "❌ Player API returned no data."
          }, { quoted: mek });
        }

        // ✅ Prefer direct video_url (raw), fallback to iframe
        const videoUrl    = playerData.video_url  || playerData.raw_url   || null;
        const iframeUrl   = playerData.raw_embed   || playerData.iframe_url || null;
        const subtitleUrl = playerData.subtitle_url || null;
        const videoType   = playerData.video_type   || "mp4";

        if (!videoUrl && !iframeUrl) {
          return await conn.sendMessage(remoteJid, {
            text: `❌ Could not extract video link.\n\n*Response:*\n\`\`\`${JSON.stringify(playerData).slice(0, 400)}\`\`\``
          }, { quoted: mek });
        }

        // ── Direct video URL available ──
        if (videoUrl) {
          const isAudio = AUDIO_EXTS.some(ext => videoUrl.toLowerCase().includes(`.${ext}`));

          const caption = `
╔══════════════════════╗
  🎬 *CineSubz Download*
╚══════════════════════╝

🎥 *${title}*
🎞 *Format:* ${videoType.toUpperCase()}
💬 *Subtitles:* ${subtitleUrl ? "✅ Available" : "❌ None"}
${"─".repeat(28)}
✅ *Powered by CineSubz v3 | Mr Senal*
          `.trim();

          if (isAudio) {
            await conn.sendMessage(remoteJid, {
              audio: { url: videoUrl },
              mimetype: "audio/mpeg",
              fileName: `${title}.${videoType}`,
              caption
            }, { quoted: mek });
          } else {
            // Send as document to avoid WhatsApp re-encoding/compression
            await conn.sendMessage(remoteJid, {
              document: { url: videoUrl },
              mimetype: "video/mp4",
              fileName: `${title.replace(/[^a-zA-Z0-9 \-_()]/g, "").trim()}.mp4`,
              caption
            }, { quoted: mek });
          }

          // Send subtitle file if available
          if (subtitleUrl) {
            await conn.sendMessage(remoteJid, {
              document: { url: subtitleUrl },
              mimetype: "text/plain",
              fileName: `${title.replace(/[^a-zA-Z0-9 \-_()]/g, "").trim()}.srt`,
              caption: "💬 *Subtitle File (.srt)*"
            }, { quoted: mek });
          }

          return;
        }

        // ── Fallback: only embed/iframe URL ──
        return await conn.sendMessage(remoteJid, {
          text: `
🎬 *${title}*
${"─".repeat(28)}
⚠️ *Direct download unavailable.*

🔗 *Stream / Download via link:*
${iframeUrl}

💡 Open in browser → long press video → save.
          `.trim()
        }, { quoted: mek });
      }

    } catch (err) {
      console.error("CineSubz Button Error:", err);
      const isTimeout = err.code === "ECONNABORTED";
      await conn.sendMessage(remoteJid, {
        text: isTimeout
          ? "⏳ *Request timed out (5 min). Server is busy. Please try again.*"
          : `❌ Something went wrong.\n\`${err.message}\``
      }, { quoted: mek });
    }
  }
});
