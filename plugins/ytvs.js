const { cmd } = require("../command");
const yts = require("yt-search");
const ytdl = require("ytdl-core");
const youtubeDl = require("youtube-dl-exec");
const { v4: uuidv4 } = require("uuid");

// In-memory storage for download tokens (in production, use Redis or database)
const downloadTokens = new Map();

// Clean up expired tokens every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of downloadTokens.entries()) {
        if (now - data.timestamp > 600000) {
            // 10 minutes TTL
            downloadTokens.delete(token);
        }
    }
}, 600000);

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
 * Store download URL with token and return token
 */
const storeDownloadUrl = (url, format = "mp3", title = "audio") => {
    const token = uuidv4().substring(0, 8); // Short token
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
 * Get direct audio download URL using multiple methods with fallbacks
 */
const getAudioDownloadUrl = async (youtubeUrl) => {
    console.log("🔍 Attempting to get download URL for:", youtubeUrl);

    // Method 1: Try yt-dlp via youtube-dl-exec (most reliable)
    try {
        console.log("📥 Trying yt-dlp method...");
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

            // Get additional info for metadata
            let title = "Unknown";
            let duration = 0;
            try {
                const infoOutput = await youtubeDl(youtubeUrl, {
                    binary: "yt-dlp",
                    dumpSingleJson: true,
                    quiet: true,
                    noWarnings: true,
                });
                if (infoOutput) {
                    title = infoOutput.title || "Unknown";
                    duration = infoOutput.duration || 0;
                }
            } catch (infoError) {
                console.warn("⚠️ Could not get metadata:", infoError.message);
            }

            return {
                url: output.trim(),
                method: "yt-dlp",
                quality: "best available",
                format: "m4a",
                title: title,
                duration: duration,
            };
        }
    } catch (error) {
        console.warn("⚠️ yt-dlp failed:", error.message);
    }

    // Method 2: Try ytdl-core with user agent
    try {
        if (ytdl.validateURL(youtubeUrl)) {
            console.log("📥 Trying ytdl-core method...");
            const info = await ytdl.getInfo(youtubeUrl, {
                requestOptions: {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    },
                },
            });

            const audioFormats = ytdl.filterFormats(info.formats, "audioonly");

            if (audioFormats.length > 0) {
                // Prefer m4a format for better compatibility
                const m4aFormat =
                    audioFormats.find((f) => f.container === "m4a") ||
                    audioFormats[0];
                console.log("✅ ytdl-core: Found audio URL");
                return {
                    url: m4aFormat.url,
                    method: "ytdl-core",
                    quality: m4aFormat.audioBitrate || "unknown",
                    format: m4aFormat.container || "audio",
                    title: info.videoDetails.title || "Unknown",
                    duration: parseInt(info.videoDetails.lengthSeconds) || 0,
                };
            }
        }
    } catch (error) {
        console.warn("⚠️ ytdl-core failed:", error.message);
    }

    // Method 3: Fallback using yt-dlp with different options
    try {
        console.log("📥 Trying yt-dlp fallback method...");
        const output = await youtubeDl(youtubeUrl, {
            binary: "yt-dlp",
            getUrl: true,
            format: "bestaudio",
            quiet: true,
            addHeader: [
                "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            ],
        });

        if (output && typeof output === "string" && output.startsWith("http")) {
            console.log("✅ yt-dlp fallback: Found audio URL");
            return {
                url: output.trim(),
                method: "yt-dlp-fallback",
                quality: "best available",
                format: "webm",
                title: "Unknown",
                duration: 0,
            };
        }
    } catch (error) {
        console.warn("⚠️ yt-dlp fallback failed:", error.message);
    }

    console.error("❌ All download methods failed");
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
            if (!q)
                return reply("❗Please provide a YouTube link or song name.");

            console.log("🎵 Processing request:", q);

            let youtubeUrl;

            // If it's a direct YouTube URL, normalize it
            if (q.startsWith("http")) {
                youtubeUrl = normalizeYouTubeURL(q);
                console.log("🔗 Direct URL provided:", youtubeUrl);
            } else {
                // Search for the song
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

            // Validate YouTube URL
            if (!ytdl.validateURL(youtubeUrl)) {
                console.error("❌ Invalid YouTube URL:", youtubeUrl);
                return reply("❌ Invalid YouTube URL provided.");
            }

            // Get video info for display
            const videoInfo = await ytdl.getInfo(youtubeUrl);
            const details = videoInfo.videoDetails;

            const caption = `
🎧 ━━━ 『 *SENAL MD - MP3 DOWNLOADER* 』━━━

🎵 *Title:* ${details.title}
🕒 *Duration:* ${new Date(details.lengthSeconds * 1000).toISOString().substr(11, 8)}
👁️ *Views:* ${parseInt(details.viewCount).toLocaleString()}
📅 *Author:* ${details.author.name}
🔗 *Link:* ${youtubeUrl}

⏬ Getting download link...
`.trim();

            // Send initial message with video info
            const sentMessage = await conn.sendMessage(
                from,
                {
                    image: {
                        url: details.thumbnails[details.thumbnails.length - 1]
                            .url,
                    },
                    caption,
                },
                { quoted: mek },
            );

            // Get download URL
            console.log("📥 Getting download URL...");
            const downloadResult = await getAudioDownloadUrl(youtubeUrl);

            if (!downloadResult?.url) {
                console.error("❌ Failed to get download URL");
                return reply(
                    "❌ Failed to fetch download link. The video might be restricted or unavailable for download.",
                );
            }

            console.log(
                `✅ Download URL obtained via ${downloadResult.method}`,
            );

            // Store download URL with token for secure button handling
            const voiceToken = storeDownloadUrl(
                downloadResult.url,
                downloadResult.format,
                downloadResult.title,
            );
            const docToken = storeDownloadUrl(
                downloadResult.url,
                downloadResult.format,
                downloadResult.title,
            );

            // Update message with download options
            const finalCaption = `
🎧 ━━━ 『 *SENAL MD - MP3 DOWNLOADER* 』━━━

🎵 *Title:* ${details.title}
🕒 *Duration:* ${new Date(details.lengthSeconds * 1000).toISOString().substr(11, 8)}
👁️ *Views:* ${parseInt(details.viewCount).toLocaleString()}
📅 *Author:* ${details.author.name}
🔗 *Link:* ${youtubeUrl}

✅ *Ready for download!*
📊 *Method:* ${downloadResult.method}
🎵 *Quality:* ${downloadResult.quality}

⏬ Select how you want to receive the audio:
`.trim();

            // Button message options with secure tokens
            const buttons = [
                {
                    buttonId: `voice_${voiceToken}`,
                    buttonText: { displayText: "🎙 Voice Note" },
                    type: 1,
                },
                {
                    buttonId: `doc_${docToken}`,
                    buttonText: { displayText: "📄 Document" },
                    type: 1,
                },
            ];

            // Send message with safe thumbnail handling
            const messageOptions = {
                caption: finalCaption,
                buttons,
                headerType: 4,
            };

            if (details.thumbnails && details.thumbnails.length > 0) {
                messageOptions.image = {
                    url: details.thumbnails[details.thumbnails.length - 1].url,
                };
            }

            await conn.sendMessage(from, messageOptions, { quoted: mek });
        } catch (err) {
            console.error("❌ Error in song downloader:", err);

            // Provide more specific error messages
            let errorMessage =
                "❌ An error occurred while processing the song.";

            if (err.message.includes("Video unavailable")) {
                errorMessage =
                    "❌ This video is not available for download (might be private or deleted).";
            } else if (err.message.includes("age-restricted")) {
                errorMessage =
                    "❌ This video is age-restricted and cannot be downloaded.";
            } else if (err.message.includes("network")) {
                errorMessage = "❌ Network error. Please try again later.";
            } else if (err.message.includes("rate limit")) {
                errorMessage =
                    "❌ Rate limited. Please wait a moment before trying again.";
            }

            reply(errorMessage);
        }
    },
);

// Handle button selection - Voice Note
cmd(
    {
        pattern: "voice_",
        onlyButton: true,
    },
    async (conn, mek, m, { from, text }) => {
        try {
            const token = text.replace("voice_", "");
            const downloadData = getDownloadFromToken(token);

            if (!downloadData) {
                console.error("❌ Invalid or expired token:", token);
                return await conn.sendMessage(
                    from,
                    {
                        text: "❌ Download link expired. Please request the song again.",
                    },
                    { quoted: mek },
                );
            }

            console.log("🎙 Sending as voice note...");

            // Determine appropriate mimetype based on format
            let mimetype = "audio/ogg";
            if (downloadData.format === "mp3") {
                mimetype = "audio/mpeg";
            } else if (downloadData.format === "m4a") {
                mimetype = "audio/mp4";
            }

            await conn.sendMessage(
                from,
                {
                    audio: { url: downloadData.url },
                    mimetype: mimetype,
                    ptt: true, // Voice note format
                },
                { quoted: mek },
            );

            console.log("✅ Voice note sent successfully");

            // Clean up token after use
            downloadTokens.delete(token);
        } catch (error) {
            console.error("❌ Error sending voice note:", error);
            await conn.sendMessage(
                from,
                {
                    text: "❌ Failed to send voice note. The audio might be too large or in an unsupported format.",
                },
                { quoted: mek },
            );
        }
    },
);

// Handle button selection - Document
cmd(
    {
        pattern: "doc_",
        onlyButton: true,
    },
    async (conn, mek, m, { from, text }) => {
        try {
            const token = text.replace("doc_", "");
            const downloadData = getDownloadFromToken(token);

            if (!downloadData) {
                console.error("❌ Invalid or expired token:", token);
                return await conn.sendMessage(
                    from,
                    {
                        text: "❌ Download link expired. Please request the song again.",
                    },
                    { quoted: mek },
                );
            }

            console.log("📄 Sending as document...");

            // Determine appropriate mimetype and filename
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
                    mimetype: mimetype,
                    fileName: fileName,
                },
                { quoted: mek },
            );

            console.log("✅ Document sent successfully");

            // Clean up token after use
            downloadTokens.delete(token);
        } catch (error) {
            console.error("❌ Error sending document:", error);
            await conn.sendMessage(
                from,
                {
                    text: "❌ Failed to send document. The audio might be too large or in an unsupported format.",
                },
                { quoted: mek },
            );
        }
    },
);
