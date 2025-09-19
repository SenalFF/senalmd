// play2.js - YouTube Audio Downloader Plugin
const { cmd } = require("../command");
const yts = require("yt-search");
const youtubedl = require("youtube-dl-exec");

// Helper: Search YouTube if input is not URL
async function searchYouTube(query) {
    const result = await yts(query);
    if (!result || !result.videos || result.videos.length === 0) return null;
    return result.videos[0];
}

// Helper: Get audio info via yt-dlp
async function getAudioInfo(url) {
    const info = await youtubedl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        youtubeSkipDashManifest: true,
        format: "bestaudio[ext=m4a]/bestaudio"
    });

    const audioFormat = info.formats.find(f => f.url && f.acodec !== "none");
    if (!audioFormat) throw new Error("No valid audio format found");

    return {
        title: info.title,
        duration: info.duration,
        uploader: info.uploader,
        url: audioFormat.url,
        format: audioFormat.ext,
        thumbnail: info.thumbnails?.[0]?.url || null
    };
}

// Main play2 command
cmd(
    {
        pattern: "play2",
        desc: "🎧 Download YouTube Audio",
        category: "download",
        react: "🎵"
    },
    async (conn, mek, m, { from, q, reply }) => {
        if (!q) return reply("❌ Please provide a YouTube link or song name.");

        try {
            let videoUrl;
            if (q.startsWith("http")) {
                videoUrl = q;
            } else {
                const search = await searchYouTube(q);
                if (!search) return reply("❌ No results found.");
                videoUrl = search.url;
            }

            const audio = await getAudioInfo(videoUrl);

            const buttons = [
                { buttonId: `playaudio ${videoUrl}`, buttonText: { displayText: "🎶 Play Audio" }, type: 1 },
                { buttonId: `playdoc ${videoUrl}`, buttonText: { displayText: "📄 Document" }, type: 1 },
                { buttonId: `playvoice ${videoUrl}`, buttonText: { displayText: "🎤 Voice Note" }, type: 1 }
            ];

            const buttonMessage = {
                text: `🎵 *${audio.title}*\n👤 ${audio.uploader}\n⏱ Duration: ${audio.duration}s`,
                footer: "@mr senal",
                buttons,
                headerType: 4,
                contextInfo: {
                    externalAdReply: {
                        title: audio.title,
                        body: `By ${audio.uploader}`,
                        thumbnailUrl: audio.thumbnail,
                        mediaType: 2,
                        sourceUrl: videoUrl
                    }
                }
            };

            await conn.sendMessage(from, buttonMessage);

        } catch (err) {
            console.error("❌ play2 error:", err);
            reply("❌ An error occurred while processing the song. Please try again later.");
        }
    }
);

// Button handlers
cmd(
    {
        pattern: "playaudio|playdoc|playvoice",
        onlyButton: true
    },
    async (conn, mek, m, { from, text }) => {
        try {
            const [command, url] = text.split(" ");
            const audio = await getAudioInfo(url);

            if (command === "playaudio") {
                await conn.sendMessage(from, {
                    audio: { url: audio.url },
                    mimetype: audio.format === "m4a" ? "audio/mp4" : "audio/mpeg",
                    fileName: `${audio.title}.${audio.format}`
                });
            } else if (command === "playdoc") {
                await conn.sendMessage(from, {
                    document: { url: audio.url },
                    mimetype: audio.format === "m4a" ? "audio/mp4" : "audio/mpeg",
                    fileName: `${audio.title}.${audio.format}`
                });
            } else if (command === "playvoice") {
                await conn.sendMessage(from, {
                    audio: { url: audio.url },
                    mimetype: "audio/ogg; codecs=opus",
                    ptt: true
                });
            }
        } catch (err) {
            console.error("❌ buttonHandler error:", err);
            await conn.sendMessage(from, { text: "❌ Failed to download or send the audio." });
        }
    }
);
