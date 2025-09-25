// ================== Required Modules ==================
const { cmd } = require("../command");
const yts = require("yt-search");
const { Innertube } = require("youtubei.js");
const fetch = require("node-fetch"); // optional if Node >= 18
let youtube;

// Init YouTube API once
(async () => {
    youtube = await Innertube.create({ fetch });
    console.log("✅ YouTube client initialized");
})();

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

/**
 * Get audio stream using youtubei.js download()
 */
async function getAudioStream(videoId) {
    return youtube.download(videoId, {
        type: "audio",
        quality: "best"
    });
}

/**
 * Sanitize file name (remove illegal chars)
 */
function safeFileName(title) {
    return title.replace(/[<>:"/\\|?*]+/g, "").trim();
}

// 🎵 SONG COMMAND
cmd({
    pattern: "play2",
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

        // Button message options
        const buttons = [
            { buttonId: `voice_${data.videoId}_${encodeURIComponent(data.title)}`, buttonText: { displayText: "🎙 Voice Note" }, type: 1 },
            { buttonId: `doc_${data.videoId}_${encodeURIComponent(data.title)}`, buttonText: { displayText: "📄 Document" }, type: 1 },
            { buttonId: `audio_${data.videoId}_${encodeURIComponent(data.title)}`, buttonText: { displayText: "🎧 Audio File" }, type: 1 },
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

// Handle button: Voice Note
cmd({
    pattern: "voice_",
    fromMe: true,
    onlyButton: true
}, async (conn, mek, m, { from, text }) => {
    const parts = text.split("_");
    const videoId = parts[1];
    const title = decodeURIComponent(parts.slice(2).join("_")) || "audio";
    if (!videoId) return console.log("Voice button click without videoId");
    try {
        const stream = await getAudioStream(videoId);
        await conn.sendMessage(from, { audio: stream, mimetype: "audio/mpeg", ptt: true }, { quoted: mek });
    } catch (e) {
        console.error("Error sending voice note:", e);
    }
});

// Handle button: Document
cmd({
    pattern: "doc_",
    fromMe: true,
    onlyButton: true
}, async (conn, mek, m, { from, text }) => {
    const parts = text.split("_");
    const videoId = parts[1];
    const title = decodeURIComponent(parts.slice(2).join("_")) || "audio";
    if (!videoId) return console.log("Doc button click without videoId");
    try {
        const stream = await getAudioStream(videoId);
        await conn.sendMessage(from, { 
            document: stream, 
            mimetype: "audio/mpeg", 
            fileName: `${safeFileName(title)}.mp3` 
        }, { quoted: mek });
    } catch (e) {
        console.error("Error sending document:", e);
    }
});

// Handle button: Normal Audio File
cmd({
    pattern: "audio_",
    fromMe: true,
    onlyButton: true
}, async (conn, mek, m, { from, text }) => {
    const parts = text.split("_");
    const videoId = parts[1];
    const title = decodeURIComponent(parts.slice(2).join("_")) || "audio";
    if (!videoId) return console.log("Audio button click without videoId");
    try {
        const stream = await getAudioStream(videoId);
        await conn.sendMessage(from, { 
            audio: stream, 
            mimetype: "audio/mpeg", 
            fileName: `${safeFileName(title)}.mp3` 
        }, { quoted: mek });
    } catch (e) {
        console.error("Error sending normal audio file:", e);
    }
});
