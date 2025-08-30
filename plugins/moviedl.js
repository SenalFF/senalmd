const { cmd } = require("../command");
const { sinhalaSub } = require("mrnima-moviedl");

// Initialize the scraper
let movieScraper;
(async () => { movieScraper = await sinhalaSub(); })();

// -------------------------------------
// Search Movies & TV Shows
cmd({
  pattern: "sub",
  react: "🎬",
  desc: "Search Sinhala Subtitles (Movies & TV Shows)",
  category: "download",
  use: ".sub <movie/tv name>",
  filename: __filename
}, async (conn, m, { args }) => {
  if (!args[0]) return m.reply("❌ Please enter a movie or TV show name.");

  const query = args.join(" ");
  let res = await movieScraper.search(query).catch(() => null);
  if (!res || !res.status || res.result.length === 0) return m.reply("❌ No Sinhala subtitles found!");

  const results = res.result.slice(0, 5); // first 5 results
  const buttons = results.map((r, i) => ({
    buttonId: `.getsub ${encodeURIComponent(r.link)}`,
    buttonText: { displayText: `${i + 1}. ${r.title}` },
    type: 1
  }));

  await conn.sendMessage(m.from, {
    image: { url: results[0].img },
    caption: `🎬 *Sinhala Subtitles Search*\n🔎 Query: ${query}\n📌 Found ${res.result.length} results. Select one below:`,
    footer: "💠 MR-NIMA Sinhala Sub Downloader",
    buttons,
    headerType: 4
  }, { quoted: m });
});

// -------------------------------------
// Latest TV Shows
cmd({
  pattern: "tvsub",
  react: "📺",
  desc: "Latest TV Shows with Sinhala Subtitles",
  category: "download",
  filename: __filename
}, async (conn, m, { args }) => {
  const page = args[0] || "1";
  let res = await movieScraper.tvShows(page).catch(() => null);
  if (!res || !res.status || res.result.length === 0) return m.reply("❌ No TV shows found!");

  const results = res.result.slice(0, 5);
  const buttons = results.map((r, i) => ({
    buttonId: `.episodes ${encodeURIComponent(r.link)}`,
    buttonText: { displayText: `${i + 1}. ${r.title}` },
    type: 1
  }));

  await conn.sendMessage(m.from, {
    image: { url: results[0].img },
    caption: `📺 *Latest TV Shows Sinhala Subtitles*\n📌 Page: ${page}\nSelect a show below:`,
    footer: "💠 MR-NIMA TV Series Downloader",
    buttons,
    headerType: 4
  }, { quoted: m });
});

// -------------------------------------
// Episodes of a TV Show
cmd({
  pattern: "episodes",
  react: "📺",
  desc: "Get episodes of a TV show",
  category: "download",
  filename: __filename
}, async (conn, m, { args }) => {
  if (!args[0]) return m.reply("⚠️ Please provide TV show link.");

  const tvLink = decodeURIComponent(args[0]);
  let res = await movieScraper.episodes(tvLink).catch(() => null);
  if (!res || !res.status) return m.reply("❌ Could not fetch episodes.");

  const epList = res.result.episodes || [];
  if (epList.length === 0) return m.reply("❌ No episodes found.");

  const buttons = epList.slice(0, 10).map((ep, i) => ({
    buttonId: `.getsub ${encodeURIComponent(ep.link)}`,
    buttonText: { displayText: `Ep ${i + 1}: ${ep.title}` },
    type: 1
  }));

  await conn.sendMessage(m.from, {
    image: { url: res.result.image },
    caption: `📺 *${res.result.title}*\n🗓️ Air date: ${res.result.first_air}\n📌 Total episodes: ${res.result.episodes_count}\nSelect episode below:`,
    footer: "💠 MR-NIMA TV Episodes Downloader",
    buttons,
    headerType: 4
  }, { quoted: m });
});

// -------------------------------------
// Get Download Links
cmd({
  pattern: "getsub",
  desc: "Get download links for movie/episode",
  category: "download",
  filename: __filename
}, async (conn, m, { args }) => {
  if (!args[0]) return m.reply("⚠️ Link missing.");

  const link = decodeURIComponent(args[0]);
  let res = await movieScraper.download(link).catch(() => null);
  if (!res || !res.status) return m.reply("❌ Could not fetch download links.");

  const links = res.result.links || [];
  if (links.length === 0) return m.reply("❌ No download links available.");

  const buttons = links.map(l => ({
    buttonId: `.dl ${encodeURIComponent(l.link)}`,
    buttonText: { displayText: `${l.quality} (${l.size})` },
    type: 1
  }));

  await conn.sendMessage(m.from, {
    image: { url: res.result.image },
    caption: `🎬 *${res.result.title}*\n📅 Date: ${res.result.date}\n⏱ Duration: ${res.result.duration}\nSelect quality below:`,
    footer: "💠 MR-NIMA Sinhala Downloader",
    buttons,
    headerType: 4
  }, { quoted: m });
});

// -------------------------------------
// Direct Download Link
cmd({
  pattern: "dl",
  desc: "Send direct download link",
  category: "download",
  filename: __filename
}, async (conn, m, { args }) => {
  if (!args[0]) return m.reply("⚠️ Download link missing.");
  const dlLink = decodeURIComponent(args[0]);
  await m.reply(`📥 *Download Link:*\n${dlLink}`);
});
