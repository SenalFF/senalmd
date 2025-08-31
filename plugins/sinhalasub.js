const { cmd } = require("../command");
const { getSearch } = require("sinhalasub.lk"); // external lib

cmd({
  pattern: "mvs",
  desc: "Search Sinhala subtitle movies",
  category: "download",
  use: ".mvs <movie name>",
  filename: __filename
}, async (conn, m, { args }) => {
  if (!args[0]) return m.reply("🎬 *Please enter a movie name.*");

  try {
    const query = args.join(" ");
    const results = await getSearch(query);

    if (!results || results.length === 0) {
      return m.reply("❌ Movie not found.");
    }

    let msg = `🎬 *Movie Search Results for:* ${query}\n\n`;

    results.slice(0, 5).forEach((movie, i) => {
      msg += `*${i + 1}. ${movie.title}*\n`;
      msg += `📅 Year: ${movie.year || "N/A"}\n`;
      msg += `🔗 Link: ${movie.url}\n\n`;
    });

    await conn.sendMessage(m.chat, { text: msg }, { quoted: m });

  } catch (e) {
    console.error(e);
    m.reply("⚠️ Error occurred while searching movie.");
  }
});
