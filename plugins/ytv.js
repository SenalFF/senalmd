// ================== Required Modules ==================
const { cmd } = require("../command"); // Updated to use Innertube for search as well (removed yt-search dependency)
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
 * Get video data using Innertube (supports URLs and search queries)
 */
async function getVideoData(query) {
    try {
        let video;
        let isDirectURL = query.startsWith("http") || query.match(/^[a-zA-Z0-9_-]{11}$/); // Check for URL or bare video ID

        if (isDirectURL) {
            const normalized = isDirectURL && query.startsWith("http") ? normalizeYouTubeURL(query) : query;
            video = await youtube.video(normalized);
        } else {
            // Search query
            const search = await youtube.search(query, FilterVideos);
            video = search.videos[0];
        }

        if (!video) return null;

        // Extract data (note: upload date formatting is approximated as "N/A" for simplicity; extend if needed)
        const title = video.title;
        const duration = video.duration ? video.duration.toString() : "Live";
        const views = video.view_count ? video.view_count.toLocaleString() : "Unknown";
        const thumbnail = video.thumbnails ? video.thumbnails[video.thumbnails.length - 1]?.url : null;
        const url = video.url || (isDirectURL ? normalizeYouTubeURL(query) : `https://www.youtube.com/watch?v=${video.id}`);
        const videoId = video.id;
        const ago = "N/A"; // Can be enhanced by parsing video.metadata.video_details.upload_date if available

        return { title, duration, views, thumbnail, url, videoId, ago };
    } catch (err) {
        console.error("Error fetching video data:", err);
        return null;
    }
}

/**
 * Get audio stream using youtubei.js (fixed to return a proper Readable stream via fetch)
 */
async function getAudioStream(videoId) {
    try {
        const dl = await youtube.download(videoId, {
            type: "audio",
            quality: "best",
            format: "mp4" // Prefer MP4 container for better compatibility
        });

        if (!dl.url) {
            throw new Error("No download URL available");
        }

        const response = await fetch(dl.url, {
            headers: {
                ...dl.headers,
                "Range": "bytes=0-" // Request full file
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.statusText}`);
        }

        return response.body; // Readable stream
    } catch (err) {
        console.error("Error in getAudioStream:", err);
        throw err;
    }
}

/**
 * Sanitize file name (remove illegal chars)
 */
function safeFileName(title) {
    return title.replace(/[<>:"/\\|?*]+/g, "").trim().substring(0, 100); // Limit length to avoid issues
}

// 🎵 SONG COMMAND (updated to use Innertube for search/info)
cmd({
    pattern: "play2",
    desc: "🎧 Download YouTube Audio",
    category: "download",
    react: "🎵",
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗Please provide a YouTube link or song name.");

        console.log(`Searching for: ${q}`);
        const data = await getVideoData(q);

        if (!data) {
            console.log("No results found for:", q);
            return reply("❌ No results found for your query.");
        }

        if (!data.thumbnail) {
            console.log("No thumbnail available for:", data.title);
        }

        console.log(`Found video: ${data.title} - ${data.url}`);

        const caption = `
🎧 ━━━ 『 *SENAL MD - MP3 DOWNLOADER* 』━━━

🎵 *Title:* ${data.title}
🕒 *Duration:* ${data.duration}
👁️ *Views:* ${data.views}
📅 *Uploaded:* ${data.ago}
🔗 *Link:* ${data.url}

⏬ Select how you want to receive the audio:
`.trim();

        // Button message options (improved title encoding for longer titles)
        const encodedTitle = encodeURIComponent(data.title.replace(/ /g, "_")); // Simple replacement for better splitting
        const buttons = [
            { buttonId: `voice_${data.videoId}_${encodedTitle}`, buttonText: { displayText: "🎙 Voice Note" }, type: 1 },
            { buttonId: `doc_${data.videoId}_${encodedTitle}`, buttonText: { displayText: "📄 Document" }, type: 1 },
            { buttonId: `audio_${data.videoId}_${encodedTitle}`, buttonText: { displayText: "🎧 Audio File" }, type: 1 },
        ];

        const messageOptions = {
            caption,
            buttons,
            headerType: 4
        };

        if (data.thumbnail) {
            messageOptions.image = { url: data.thumbnail };
        }

        await conn.sendMessage(from, messageOptions, { quoted: mek });

    } catch (err) {
        console.error("General error in play command:", err);
        reply("❌ An unexpected error occurred while processing the song. Please try again later.");
    }
});

// Handle button: Voice Note (updated decoding and error handling)
cmd({
    pattern: "voice_",
    fromMe: true,
    onlyButton: true
}, async (conn, mek, m, { from, text }) => {
    try {
        const parts = text.split("_");
        const videoId = parts[1];
        const encodedTitle = parts.slice(2).join("_");
        const title = decodeURIComponent(encodedTitle.replace(/_/g, " ")) || "audio"; // Improved decoding
        if (!videoId) return console.log("Voice button click without videoId");

        reply("⏳ Preparing voice note..."); // User feedback
        const stream = await getAudioStream(videoId);
        await conn.sendMessage(from, { 
            audio: stream, 
            mimetype: "audio/mpeg", 
            ptt: true 
        }, { quoted: mek });
    } catch (e) {
        console.error("Error sending voice note:", e);
        reply("❌ Failed to send voice note. Please try again.");
    }
});

// Handle button: Document (updated with feedback)
cmd({
    pattern: "doc_",
    fromMe: true,
    onlyButton: true
}, async (conn, mek, m, { from, text }) => {
    try {
        const parts = text.split("_");
        const videoId = parts[1];
        const encodedTitle = parts.slice(2).join("_");
        const title = decodeURIComponent(encodedTitle.replace(/_/g, " ")) || "audio";
        if (!videoId) return console.log("Doc button click without videoId");

        reply("⏳ Preparing document..."); // User feedback
        const stream = await getAudioStream(videoId);
        await conn.sendMessage(from, { 
            document: stream, 
            mimetype: "audio/mpeg", 
            fileName: `${safeFileName(title)}.mp3` 
        }, { quoted: mek });
    } catch (e) {
        console.error("Error sending document:", e);
        reply("❌ Failed to send document. Please try again.");
    }
});

// Handle button: Normal Audio File (updated with feedback)
cmd({
    pattern: "audio_",
    fromMe: true,
    onlyButton: true
}, async (conn, mek, m, { from, text }) => {
    try {
        const parts = text.split("_");
        const videoId = parts[1];
        const encodedTitle = parts.slice(2).join("_");
        const title = decodeURIComponent(encodedTitle.replace(/_/g, " ")) || "audio";
        if (!videoId) return console.log("Audio button click without videoId");

        reply("⏳ Preparing audio file..."); // User feedback
        const stream = await getAudioStream(videoId);
        await conn.sendMessage(from, { 
            audio: stream, 
            mimetype: "audio/mpeg", 
            fileName: `${safeFileName(title)}.mp3` 
        }, { quoted: mek });
    } catch (e) {
        console.error("Error sending normal audio file:", e);
        reply("❌ Failed to send audio file. Please try again.");
    }
});
