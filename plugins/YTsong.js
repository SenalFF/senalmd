const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

// 🎵 SONG COMMAND
cmd({
    pattern: "play",
    desc: "🎧 Download YouTube Audio (via Senal YT DL API)",
    category: "download",
    react: "🎵",
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Please provide a YouTube link or song name.");

        // 🔍 Search or normalize link
        const isLink = q.startsWith("http");
        const search = await yts(isLink ? q : q);
        const data = search.videos[0];
        if (!data?.videoId) return reply("❌ No results found.");

        const caption = `
🎧 ━━━ 『 *SENAL MD - MP3 DOWNLOADER* 』━━━

🎵 *Title:* ${data.title}
🕒 *Duration:* ${data.timestamp}
👁️ *Views:* ${data.views.toLocaleString()}
📅 *Uploaded:* ${data.ago}
📺 *Channel:* ${data.author.name}
🔗 *Link:* ${data.url}

⏬ Downloading MP3 via Senal YT DL...
`.trim();

        await conn.sendMessage(from, {
            image: { url: data.thumbnail },
            caption
        }, { quoted: mek });

        await reply("🎧 Fetching MP3 from Senal YT DL...");

        // 🌐 Call your API
        const apiUrl = `https://senalytdl.vercel.app/mp3?id=${data.videoId}`;
        const response = await axios.get(apiUrl, { timeout: 15000 });
        const result = response.data;

        if (!result.downloadURL) {
            return reply("❌ Failed to fetch download link from Senal YT DL.");
        }

        const audio = { url: result.downloadURL };

        // 🎶 Send MP3
        await conn.sendMessage(from, { audio, mimetype: "audio/mpeg" }, { quoted: mek });

        // 📄 Optional: also send as document
        await conn.sendMessage(from, {
            document: audio,
            mimetype: "audio/mpeg",
            fileName: `${data.title}.mp3`,
            caption: "✅ MP3 sent by *SENAL MD* 🎵"
        }, { quoted: mek });

        await reply("✅ Song downloaded successfully via *Senal YT DL*.");

    } catch (err) {
        console.error(err);
        reply("❌ Error: Failed to process your request.");
    }
});
