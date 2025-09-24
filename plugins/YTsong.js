const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3, playmp3 } = require("@kelvdra/scraper");

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

        console.log(`Searching for: ${q}`);
        const normalized = q.startsWith("http") ? normalizeYouTubeURL(q) : q;
        const search = await yts(normalized);
        const data = search.videos[0];

        if (!data?.url) {
            console.log("No search results found for:", normalized);
            return reply("❌ No results found for your query.");
        }

        console.log(`Found video: ${data.title} - ${data.url}`);

        const caption = `
🎧 ━━━ 『 *SENAL MD - MP3 DOWNLOADER* 』━━━

🎵 *Title:* ${data.title}
🕒 *Duration:* ${data.timestamp}
👁️ *Views:* ${data.views.toLocaleString()}
📅 *Uploaded:* ${data.ago}
🔗 *Link:* ${data.url}

⏬ Select how you want to receive the audio:
`.trim();

        let result = null, audioUrl = null, errorDetails = "";

        // Try ytmp3 first
        try {
            console.log(`Attempting to fetch MP3 for: ${data.url}`);
            result = await ytmp3(data.url, "mp3");
            console.log("ytmp3 result:", result);
            audioUrl = result?.url || result?.downloadUrl || result?.link || null;
        } catch (ytmp3Err) {
            errorDetails += "ytmp3 error: " + ytmp3Err?.message + "; ";
            console.error("Error from ytmp3:", ytmp3Err);
        }

        // Fallback to playmp3 by song title if ytmp3 fails or url is missing
        if (!audioUrl) {
            try {
                console.log(`ytmp3 failed or no url, trying playmp3: ${data.title}`);
                result = await playmp3(data.title);
                console.log("playmp3 result:", result);
                audioUrl = result?.url || result?.downloadUrl || result?.link || null;
            } catch (playmp3Err) {
                errorDetails += "playmp3 error: " + playmp3Err?.message + "; ";
                console.error("Error from playmp3:", playmp3Err);
            }
        }

        if (!audioUrl) {
            // Print all keys for debugging
            console.log('Audio download failed, result:', result);
            return reply(
                "❌ Failed to fetch the audio download link. The scraper might be having issues or YouTube changed something.\n" +
                (errorDetails ? "Error details: " + errorDetails + "\n" : "") +
                "Debug: " + JSON.stringify(result) + "\n" +
                "Please try again later or report this to the bot owner."
            );
        }

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
        console.error("General error in play command:", err);
        reply("❌ An unexpected error occurred while processing the song. Please try again later.");
    }
});

// Handle button selection
cmd({
    pattern: "voice_",
    fromMe: true,
    onlyButton: true
}, async (conn, mek, m, { from, text }) => {
    const audioUrl = text.replace("voice_", "");
    if (!audioUrl) return console.log("Voice button click without audioUrl");
    try {
        await conn.sendMessage(from, { audio: { url: audioUrl }, mimetype: "audio/mpeg", ptt: true }, { quoted: mek });
    } catch (e) {
        console.error("Error sending voice note:", e);
    }
});

cmd({
    pattern: "doc_",
    fromMe: true,
    onlyButton: true
}, async (conn, mek, m, { from, text }) => {
    const audioUrl = text.replace("doc_", "");
    if (!audioUrl) return console.log("Doc button click without audioUrl");
    try {
        await conn.sendMessage(from, { document: { url: audioUrl }, mimetype: "audio/mpeg", fileName: "audio.mp3" }, { quoted: mek });
    } catch (e) {
        console.error("Error sending document:", e);
    }
});
