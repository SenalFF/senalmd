const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3, ytmp4 } = require("@kelvdra/scraper");

/**
 * Normalize YouTube URL (e.g. youtu.be → youtube.com)
 */
const normalizeYouTubeURL = (url) => {
    if (url.startsWith("https://youtu.be/")) {
        const videoId = url.split("/").pop().split("?")[0];
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return url;
};

// 🎵 SONG COMMAND
cmd({
    pattern: "song",
    desc: "🎧 Download YouTube Audio",
    category: "download",
    react: "🎵",
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗Please provide a YouTube link or song name.");

        const normalized = q.startsWith("http") ? normalizeYouTubeURL(q) : q;
        const search = await yts(normalized);
        const data = search.videos[0];
        if (!data?.url) return reply("❌ No results found.");

        const caption = `
🎧 ━━━ 『 *SENAL MD - MP3 DOWNLOADER* 』━━━

🎵 *Title:* ${data.title}
🕒 *Duration:* ${data.timestamp}
👁️ *Views:* ${data.views.toLocaleString()}
📅 *Uploaded:* ${data.ago}
🔗 *Link:* ${data.url}

⏬ Downloading MP3...
`.trim();

        await conn.sendMessage(from, {
            image: { url: data.thumbnail },
            caption
        }, { quoted: mek });

        await reply("🎧 Fetching audio...");

        const result = await ytmp3(data.url, "mp3");
        if (!result?.download?.url) return reply("❌ Failed to fetch download link.");

        const audio = {
            url: result.download.url,
        };

        await conn.sendMessage(from, { audio, mimetype: "audio/mpeg" }, { quoted: mek });

        await conn.sendMessage(from, {
            document: audio,
            mimetype: "audio/mpeg",
            fileName: `${data.title}.mp3`,
            caption: "✅ MP3 sent by *SENAL MD* 🎵"
        }, { quoted: mek });

        await reply("✅ Uploaded successfully.");

    } catch (err) {
        console.error(err);
        reply("❌ An error occurred while downloading the song.");
    }
});
