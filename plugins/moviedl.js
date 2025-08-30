const { cmd } = require("../command");
const { sinhalaSub } = require("mrnima-moviedl");

let movie;
(async () => { movie = await sinhalaSub(); })();

// -------------------------------------
// Search Movies & TV Shows
cmd({
  pattern: "sub",
  desc: "Search Movies & TV Shows",
  category: "download",
  filename: __filename
}, async (conn, m, { args }) => {
  if (!args[0]) return m.reply("❌ Please provide a search term.");
  
  const query = args.join(" ");
  const res = await movie.search(query).catch(() => null);
  if (!res || !res.status || res.result.length === 0) return m.reply("❌ No results found.");
  
  let text = `🎬 *Search Results for:* ${query}\n\n`;
  res.result.slice(0, 10).forEach((item, i) => {
    text += `${i+1}. ${item.title}\nType: ${item.type}\nLink: ${item.link}\n\n`;
  });

  await m.reply(text);
});

// -------------------------------------
// New Movies
cmd({
  pattern: "newmovies",
  desc: "Latest Movies",
  category: "download",
  filename: __filename
}, async (conn, m, { args }) => {
  const page = args[0] || "1";
  const res = await movie.newMovies(page).catch(() => null);
  if (!res || !res.status || res.result.length === 0) return m.reply("❌ No new movies found.");

  let text = `🎬 *New Movies (Page ${page}):*\n\n`;
  res.result.slice(0, 10).forEach((item, i) => {
    text += `${i+1}. ${item.title}\nLink: ${item.link}\n\n`;
  });

  await m.reply(text);
});

// -------------------------------------
// TV Shows
cmd({
  pattern: "tvsub",
  desc: "Latest TV Shows",
  category: "download",
  filename: __filename
}, async (conn, m, { args }) => {
  const page = args[0] || "1";
  const res = await movie.tvShows(page).catch(() => null);
  if (!res || !res.status || res.result.length === 0) return m.reply("❌ No TV shows found.");

  let text = `📺 *Latest TV Shows (Page ${page}):*\n\n`;
  res.result.slice(0, 10).forEach((item, i) => {
    text += `${i+1}. ${item.title}\nLink: ${item.link}\n\n`;
  });

  await m.reply(text);
});

// -------------------------------------
// Episodes
cmd({
  pattern: "episodes",
  desc: "Get episodes for a TV show",
  category: "download",
  filename: __filename
}, async (conn, m, { args }) => {
  if (!args[0]) return m.reply("⚠️ Please provide TV show link.");
  const tvLink = args[0];

  const res = await movie.episodes(tvLink).catch(() => null);
  if (!res || !res.status || !res.result.episodes) return m.reply("❌ Could not fetch episodes.");

  let text = `📺 *Episodes for:* ${res.result.title}\n\n`;
  res.result.episodes.forEach((ep, i) => {
    text += `${i+1}. ${ep.title}\nLink: ${ep.link}\n\n`;
  });

  await m.reply(text);
});

// -------------------------------------
// Download Movie/Episode Links
cmd({
  pattern: "getsub",
  desc: "Get download links for movie/episode",
  category: "download",
  filename: __filename
}, async (conn, m, { args }) => {
  if (!args[0]) return m.reply("⚠️ Please provide link.");
  const link = args[0];

  const res = await movie.download(link).catch(() => null);
  if (!res || !res.status || !res.result.links) return m.reply("❌ Could not fetch download links.");

  let text = `🎬 *Download Links for:* ${res.result.title}\n\n`;
  res.result.links.forEach(l => {
    text += `${l.quality} (${l.size}): ${l.link}\n\n`;
  });

  await m.reply(text);
});
