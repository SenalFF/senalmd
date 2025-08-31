const axios = require("axios");
const { cmd } = require("../command");

cmd({
    pattern: "mv",
    alias: ["moviedl", "sinhalamovie"],
    desc: "🎬 Senal MD ⚡ | Search Sinhala Sub Movies",
    react: "🎬",
    category: "download",
    filename: __filename,
},
async (conn, mek, m, { from, reply, args }) => {
    try {
        const query = args.join(" ");
        if (!query) {
            return reply("⚡ Senal MD: Please provide a movie name!\n👉 Example: .movie Deadpool");
        }

        const { data } = await axios.get(`https://www.dark-yasiya-api.site/movie/sinhalasub/search?text=${encodeURIComponent(query)}`);

        if (!data.status || !data.result || data.result.length === 0) {
            return reply("⚡ Senal MD: No movies found for your query. Please try another name.");
        }

        let movieList = "🎬 *Senal MD ⚡ Movie Search Results* 🎬\n\n";
        data.result.slice(0, 5).forEach((movie, i) => {
            movieList += `*${i + 1}. ${movie.title}*\n📅 Year: ${movie.year || "N/A"}\n🔗 Link: ${movie.link}\n\n`;
        });

        await conn.sendMessage(from, { text: movieList }, { quoted: m });

    } catch (error) {
        console.error("Error in movie command:", error);
        reply("⚡ Senal MD: Sorry, something went wrong while fetching movie details. Please try again later.");
    }
});
