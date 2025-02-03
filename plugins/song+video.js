const { cmd } = require('../command');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');

// Normalize YouTube URL
const normalizeYouTubeURL = (url) => {
    if (url.startsWith('https://youtu.be/')) {
        const videoId = url.split('/').pop().split('?')[0];
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return url;
};

// Quality options
const AUDIO_QUALITIES = [
    { label: "64kbps", value: "lowestaudio" },
    { label: "128kbps", value: "audioonly" },
    { label: "192kbps", value: "highestaudio" }
];

const VIDEO_QUALITIES = [
    { label: "144p", value: "tiny" },
    { label: "360p", value: "lowest" },
    { label: "480p", value: "medium" },
    { label: "720p", value: "highest" }
];

let activeDownloads = {};

// ====================== SONG DOWNLOADER ======================
cmd({
    pattern: "song",
    desc: "Download songs with quality selection",
    category: "download",
    react: "🎵",
    filename: __filename,
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🚫 *Please provide a YouTube link or title!*");

        const search = await yts(q);
        const data = search.videos[0];
        const url = normalizeYouTubeURL(data.url);

        if (!url) return reply("🚫 *Video not found!*");

        let desc = `🎵 *SENAL MD SONG DOWNLOADER* 🎵
        
🎶 *Title:* ${data.title}
👀 *Views:* ${data.views}
🕒 *Duration:* ${data.timestamp}
📅 *Uploaded:* ${data.ago}

✅ *Select a quality to download:*`;

        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: desc }, { quoted: mek });

        let buttons = AUDIO_QUALITIES.map((q, i) => ({
            buttonId: `song_${i}`,
            buttonText: { displayText: `${q.label}` },
            type: 1
        }));

        await conn.sendMessage(from, {
            text: "🎧 *Select Audio Quality:*",
            footer: "Powered by SENAL",
            buttons: buttons,
            headerType: 1
        }, { quoted: mek });

        // Save the URL to track button responses
        activeDownloads[from] = { type: "song", url };
    } catch (e) {
        reply(`🚫 *Error:* ${e}`);
    }
});

// ====================== VIDEO DOWNLOADER ======================
cmd({
    pattern: "video",
    desc: "Download videos with quality selection",
    category: "download",
    react: "🎥",
    filename: __filename,
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🚫 *Please provide a YouTube link or title!*");

        const search = await yts(q);
        const data = search.videos[0];
        const url = normalizeYouTubeURL(data.url);

        if (!url) return reply("🚫 *Video not found!*");

        let desc = `🎥 *SENAL MD VIDEO DOWNLOADER* 🎥
        
🎬 *Title:* ${data.title}
👀 *Views:* ${data.views}
🕒 *Duration:* ${data.timestamp}
📅 *Uploaded:* ${data.ago}

✅ *Select a quality to download:*`;

        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: desc }, { quoted: mek });

        let buttons = VIDEO_QUALITIES.map((q, i) => ({
            buttonId: `video_${i}`,
            buttonText: { displayText: `${q.label}` },
            type: 1
        }));

        await conn.sendMessage(from, {
            text: "🎬 *Select Video Quality:*",
            footer: "Powered by SENAL",
            buttons,
            headerType: 1
        }, { quoted: mek });

        // Save the URL to track button responses
        activeDownloads[from] = { type: "video", url };
    } catch (e) {
        reply(`🚫 *Error:* ${e}`);
    }
});

// ====================== BUTTON RESPONSE HANDLER ======================
cmd({
    onButton: true,
}, async (conn, mek, m, { from, buttonId, reply }) => {
    try {
        if (!activeDownloads[from]) return reply("🚫 *No active download request!*");

        let { type, url } = activeDownloads[from];

        if (buttonId.startsWith("song_")) {
            let choice = parseInt(buttonId.split("_")[1]);
            let selectedQuality = AUDIO_QUALITIES[choice].value;

            await reply("🎧 *Downloading your song...*");

            let audioStream = ytdl(url, { quality: selectedQuality, filter: "audioonly" });

            await conn.sendMessage(from, { audio: { stream: audioStream }, mimetype: "audio/mpeg" }, { quoted: mek });
            await reply("✅ *Song sent successfully!*");
        }

        if (buttonId.startsWith("video_")) {
            let choice = parseInt(buttonId.split("_")[1]);
            let selectedQuality = VIDEO_QUALITIES[choice].value;

            await reply("🎬 *Downloading your video...*");

            let videoStream = ytdl(url, { quality: selectedQuality, filter: "videoandaudio" });

            await conn.sendMessage(from, { video: { stream: videoStream }, mimetype: "video/mp4" }, { quoted: mek });
            await reply("✅ *Video sent successfully!*");
        }

        // Remove active request after processing
        delete activeDownloads[from];

    } catch (e) {
        reply(`🚫 *Error:* ${e}`);
    }
});
