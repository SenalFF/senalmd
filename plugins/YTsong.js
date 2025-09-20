const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@kelvdra/scraper"); // Ensure this is installed: npm install @kelvdra/scraper

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
    pattern: "play",
    desc: "🎧 Download YouTube Audio",
    category: "download",
    react: "🎵",
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗Please provide a YouTube link or song name.");

        console.log(`Searching for: ${q}`); // Debugging
        const normalized = q.startsWith("http") ? normalizeYouTubeURL(q) : q;
        const search = await yts(normalized);
        const data = search.videos[0];

        if (!data?.url) {
            console.log("No search results found for:", normalized); // Debugging
            return reply("❌ No results found for your query.");
        }

        console.log(`Found video: ${data.title} - ${data.url}`); // Debugging

        const caption = `
🎧 ━━━ 『 *SENAL MD - MP3 DOWNLOADER* 』━━━

🎵 *Title:* ${data.title}
🕒 *Duration:* ${data.timestamp}
👁️ *Views:* ${data.views.toLocaleString()}
📅 *Uploaded:* ${data.ago}
🔗 *Link:* ${data.url}

⏬ Select how you want to receive the audio:
`.trim();

        let result;
        try {
            console.log(`Attempting to fetch MP3 for: ${data.url}`); // Debugging
            result = await ytmp3(data.url, "mp3");
            console.log("ytmp3 result:", result); // Debugging: See what ytmp3 returns
        } catch (ytmp3Err) {
            console.error("Error from ytmp3:", ytmp3Err); // Log the actual error from ytmp3
            return reply("❌ Failed to process the YouTube link with the scraper. (Scraper error)");
        }

        if (!result?.url) {
            console.log("ytmp3 result did not contain a URL or was null."); // Debugging
            return reply("❌ Failed to fetch the audio download link. The scraper might be having issues.");
        }

        const audioUrl = result.url;

        // Button message options
        const buttons = [
            { buttonId: `voice_${audioUrl}`, buttonText: { displayText: "🎙 Voice Note" }, type: 1 },
            { buttonId: `doc_${audioUrl}`, buttonText: { displayText: "📄 Document" }, type: 1 },
        ];

        await conn.sendMessage(from, {
            image: { url: data.thumbnail },
            caption,
            buttons,
            headerType: 4
        }, { quoted: mek });

    } catch (err) {
        console.error("General error in play command:", err); // Log any other errors
        reply("❌ An unexpected error occurred while processing the song. Please try again later.");
    }
});

// Handle button selection (unchanged, assuming these work if audioUrl is valid)
cmd({
    pattern: "voice_",
    fromMe: true, // This assumes the bot user is clicking the button
    onlyButton: true
}, async (conn, mek, m, { from, text }) => {
    const audioUrl = text.replace("voice_", "");
    if (!audioUrl) return console.log("Voice button click without audioUrl");
    try {
        await conn.sendMessage(from, { audio: { url: audioUrl }, mimetype: "audio/mpeg", ptt: true }, { quoted: mek });
    } catch (e) {
        console.error("Error sending voice note:", e);
        // Consider replying to the user that the file couldn't be sent
    }
});

cmd({
    pattern: "doc_",
    fromMe: true, // This assumes the bot user is clicking the button
    onlyButton: true
}, async (conn, mek, m, { from, text }) => {
    const audioUrl = text.replace("doc_", "");
    if (!audioUrl) return console.log("Doc button click without audioUrl");
    try {
        await conn.sendMessage(from, { document: { url: audioUrl }, mimetype: "audio/mpeg", fileName: "audio.mp3" }, { quoted: mek });
    } catch (e) {
        console.error("Error sending document:", e);
        // Consider replying to the user that the file couldn't be sent
    }
});
