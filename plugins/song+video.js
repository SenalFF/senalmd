const { cmd } = require('../command');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');

cmd({
    pattern: "song",
    desc: "Download a song from YouTube",
    category: "download",
    react: "🎵",
    filename: __filename,
},
async (sock, message, m, { from, q, reply }) => {
    try {
        if (!q) {
            return await reply("🚫 *Provide a YouTube link or title!*");
        }

        const search = await yts(q);
        const video = search.videos[0];
        if (!video) {
            return await reply("🚫 *No results found!*");
        }

        let desc = `🎵 *SENAL MD SONG DOWNLOADER* 🎶\n\n` +
                   `📌 *Title:* ${video.title}\n` +
                   `👀 *Views:* ${video.views}\n` +
                   `📝 *Description:* ${video.description}\n` +
                   `⏳ *Duration:* ${video.timestamp}\n` +
                   `📅 *Uploaded:* ${video.ago}\n\n` +
                   `💠 *Powered by SENAL*`;

        await sock.sendMessage(from, { image: { url: video.thumbnail }, caption: desc }, { quoted: message });

        await reply("🎶 *Downloading your song...* ⏳");

        let audioStream = ytdl(video.url, { filter: "audioonly", quality: "highestaudio" });
        await sock.sendMessage(from, { audio: { stream: audioStream }, mimetype: "audio/mpeg" }, { quoted: message });

        await reply("✅ *Song uploaded!* 🎵");
    } catch (e) {
        await reply(`🚫 *Error:* ${e.message}`);
    }
});

cmd({
    pattern: "video",
    desc: "Download a video from YouTube",
    category: "download",
    react: "🎥",
    filename: __filename,
},
async (sock, message, m, { from, q, reply }) => {
    try {
        if (!q) {
            return await reply("🚫 *Provide a YouTube link or title!*");
        }

        const search = await yts(q);
        const video = search.videos[0];
        if (!video) {
            return await reply("🚫 *No results found!*");
        }

        let desc = `🎬 *SENAL MD VIDEO DOWNLOADER* 🎥\n\n` +
                   `📌 *Title:* ${video.title}\n` +
                   `👀 *Views:* ${video.views}\n` +
                   `📝 *Description:* ${video.description}\n` +
                   `⏳ *Duration:* ${video.timestamp}\n` +
                   `📅 *Uploaded:* ${video.ago}\n\n` +
                   `💠 *Powered by SENAL*`;

        await sock.sendMessage(from, { image: { url: video.thumbnail }, caption: desc }, { quoted: message });

        await reply("🎥 *Downloading your video...* ⏳");

        let videoStream = ytdl(video.url, { quality: "highest" });
        await sock.sendMessage(from, { video: { stream: videoStream }, mimetype: "video/mp4" }, { quoted: message });

        await reply("✅ *Video uploaded!* 🎬");
    } catch (e) {
        await reply(`🚫 *Error:* ${e.message}`);
    }
});
