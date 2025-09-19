const { cmd } = require("../command");
const yts = require("yt-search");
const youtubeDl = require("youtube-dl-exec");
const { v4: uuidv4 } = require("uuid");

// In-memory storage for download tokens (in production, use Redis or DB)
const downloadTokens = new Map();

// Clean up expired tokens every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of downloadTokens.entries()) {
        if (now - data.timestamp > 600000) {
            downloadTokens.delete(token);
        }
    }
}, 600000);

/**
 * Store download URL with token and return token
 */
const storeDownloadUrl = (url, format = "mp3", title = "audio") => {
    const token = uuidv4().substring(0, 8);
    downloadTokens.set(token, {
        url,
        format,
        title: title.replace(/[^a-zA-Z0-9\s-]/g, "").trim() || "audio",
        timestamp: Date.now(),
    });
    return token;
};

/**
 * Get download URL from token
 */
const getDownloadFromToken = (token) => {
    return downloadTokens.get(token);
};

/**
 * Get direct audio download URL using yt-dlp only
 */
const getAudioDownloadUrl = async (youtubeUrl) => {
    console.log("🔍 Attempting to get download URL for:", youtubeUrl);

    try {
        console.log("📥 Using yt-dlp...");
        const output = await youtubeDl(youtubeUrl, {
            binary: "yt-dlp",
            getUrl: true,
            format: "bestaudio[ext=m4a]/bestaudio",
            quiet: true,
            noWarnings: true,
            addHeader: [
                "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            ],
        });

        if (output && typeof output === "string" && output.startsWith("http")) {
            console.log("✅ yt-dlp: Found audio URL");

            // Get metadata
            let infoOutput = await youtubeDl(youtubeUrl, {
                binary: "yt-dlp",
                dumpSingleJson: true,
                quiet: true,
                noWarnings: true,
            });

            return {
                url: output.trim(),
                method: "yt-dlp",
                quality: "best available",
                format: "m4a",
                title: infoOutput.title || "Unknown",
                duration: infoOutput.duration || 0,
                views: infoOutput.view_count || 0,
                author: infoOutput.uploader || "Unknown",
                thumbnails: infoOutput.thumbnails || [],
            };
        }
    } catch (error) {
        console.error("❌ yt-dlp failed:", error.message);
    }

    console.error("❌ Could not fetch audio link");
    return null;
};

// 🎵 SONG COMMAND
cmd(
    {
        pattern: "play2",
        desc: "🎧 Download YouTube Audio",
        category: "download",
        react: "🎵",
    },
    async (conn, mek, m, { from, q, reply }) => {
        try {
            if (!q) return reply("❗Please provide a YouTube link or song name.");

            console.log("🎵 Processing request:", q);

            let youtubeUrl;

            if (q.startsWith("http")) {
                youtubeUrl = q;
                console.log("🔗 Direct URL provided:", youtubeUrl);
            } else {
                console.log("🔍 Searching for:", q);
                const search = await yts(q);
                const data = search.videos[0];

                if (!data?.url) {
                    console.error("❌ No search results found for:", q);
                    return reply("❌ No results found for your search query.");
                }

                youtubeUrl = data.url;
                console.log("🎯 Found video:", data.title);
            }

            // Get download URL + metadata via yt-dlp
            console.log("📥 Getting download URL...");
            const downloadResult = await getAudioDownloadUrl(youtubeUrl);

            if (!downloadResult?.url) {
                console.error("❌ Failed to get download URL");
                return reply("❌ Failed to fetch download link. The video might be restricted or unavailable for download.");
            }

            console.log(`✅ Download URL obtained via ${downloadResult.method}`);

            const details = downloadResult;

            const caption = `
🎧 ━━━ 『 *SENAL MD - MP3 DOWNLOADER* 』━━━

🎵 *Title:* ${details.title}
🕒 *Duration:* ${new Date(details.duration * 1000).toISOString().substr(11, 8)}
👁️ *Views:* ${parseInt(details.views).toLocaleString()}
📅 *Author:* ${details.author}
🔗 *Link:* ${youtubeUrl}

✅ *Ready for download!*
📊 *Method:* ${downloadResult.method}
🎵 *Quality:* ${downloadResult.quality}

⏬ Select how you want to receive the audio:
`.trim();

            const voiceToken = storeDownloadUrl(downloadResult.url, downloadResult.format, downloadResult.title);
            const docToken = storeDownloadUrl(downloadResult.url, downloadResult.format, downloadResult.title);

            const buttons = [
                { buttonId: `voice_${voiceToken}`, buttonText: { displayText: "🎙 Voice Note" }, type: 1 },
                { buttonId: `doc_${docToken}`, buttonText: { displayText: "📄 Document" }, type: 1 },
            ];

            const messageOptions = {
                caption,
                buttons,
                headerType: 4,
            };

            if (details.thumbnails && details.thumbnails.length > 0) {
                messageOptions.image = { url: details.thumbnails[details.thumbnails.length - 1].url };
            }

            await conn.sendMessage(from, messageOptions, { quoted: mek });
        } catch (err) {
            console.error("❌ Error in song downloader:", err);
            reply("❌ An error occurred while processing the song. Please try again later.");
        }
    },
);

// Handle button selection - Voice Note
cmd(
    { pattern: "voice_", onlyButton: true },
    async (conn, mek, m, { from, text }) => {
        try {
            const token = text.replace("voice_", "");
            const downloadData = getDownloadFromToken(token);

            if (!downloadData) {
                return await conn.sendMessage(from, { text: "❌ Download link expired. Please request the song again." }, { quoted: mek });
            }

            console.log("🎙 Sending as voice note...");

            let mimetype = "audio/ogg";
            if (downloadData.format === "mp3") mimetype = "audio/mpeg";
            else if (downloadData.format === "m4a") mimetype = "audio/mp4";

            await conn.sendMessage(
                from,
                {
                    audio: { url: downloadData.url },
                    mimetype,
                    ptt: true,
                },
                { quoted: mek },
            );

            downloadTokens.delete(token);
        } catch (error) {
            console.error("❌ Error sending voice note:", error);
            await conn.sendMessage(from, { text: "❌ Failed to send voice note." }, { quoted: mek });
        }
    },
);

// Handle button selection - Document
cmd(
    { pattern: "doc_", onlyButton: true },
    async (conn, mek, m, { from, text }) => {
        try {
            const token = text.replace("doc_", "");
            const downloadData = getDownloadFromToken(token);

            if (!downloadData) {
                return await conn.sendMessage(from, { text: "❌ Download link expired. Please request the song again." }, { quoted: mek });
            }

            console.log("📄 Sending as document...");

            let mimetype = "audio/mpeg";
            let fileName = `${downloadData.title}.mp3`;

            if (downloadData.format === "m4a") {
                mimetype = "audio/mp4";
                fileName = `${downloadData.title}.m4a`;
            } else if (downloadData.format === "webm") {
                mimetype = "audio/webm";
                fileName = `${downloadData.title}.webm`;
            }

            await conn.sendMessage(
                from,
                {
                    document: { url: downloadData.url },
                    mimetype,
                    fileName,
                },
                { quoted: mek },
            );

            downloadTokens.delete(token);
        } catch (error) {
            console.error("❌ Error sending document:", error);
            await conn.sendMessage(from, { text: "❌ Failed to send document." }, { quoted: mek });
        }
    },
);
