// ================== Required Modules ==================
const { cmd } = require("../command");
const yts = require("yt-search");
const { Innertube } = require("youtubei.js");
const fetch = require("node-fetch"); // not needed if Node.js v18+
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
 * Get best audio stream URL from YouTube
 */
async function getMp3Url(videoId) {
    const info = await youtube.getInfo(videoId);

    const audioFormat = info.streaming_data?.adaptive_formats?.find(f =>
        f.mimeType.includes("audio/mp4")
    );

    if (!audioFormat?.url) throw new Error("No audio stream found");

    return {
        title: info.basic_info.title,
        author: info.basic_info.author,
        duration: info.basic_info.duration,
        url: audioFormat.url
    };
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

        let result, audioUrl;
        try {
            console.log(`Fetching MP3 URL for: ${data.videoId}`);
            result = await getMp3Url(data.videoId);
            audioUrl = result.url;
        } catch (err) {
            console.error("Error fetching MP3:", err);
            return reply("❌ Failed to fetch the audio stream. Please try again later.");
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
