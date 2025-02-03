const { cmd } = require('../command');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');

// Quality options for audio and video
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

// Quality prompt for both audio and video
const qualityPrompt = (type, qualities) => {
    let msg = `⚠️ *Select a ${type} quality by sending a number:*\n\n`;
    qualities.forEach((q, i) => {
        msg += `*${i + 1} - ${q.label}*\n`;
    });
    msg += `\n🎶 *For songs, use 64kbps or 128kbps.*\n🎬 *For videos, use 360p or 144p.*\n🚨 *Reply with the number!*`;
    return msg;
};

// ========== SONG DOWNLOADER ==========
cmd({
    pattern: "song",
    desc: "Download songs with quality selection",
    category: "download",
    react: "🎵",
    filename: __filename,
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🚫 *Provide a YouTube link or title!*");

        const search = await yts(q);
        const data = search.videos[0];
        if (!data) return reply("🚫 *No results found!*");

        let desc = `🎵 *SENAL MD SONG DOWNLOADER* 🎶\n\n` +
                   `📌 *Title:* ${data.title}\n` +
                   `👀 *Views:* ${data.views}\n` +
                   `📝 *Description:* ${data.description}\n` +
                   `⏳ *Duration:* ${data.timestamp}\n` +
                   `📅 *Uploaded:* ${data.ago}\n\n` +
                   `💠 *Powered by SENAL*`;

        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: desc }, { quoted: mek });
        await reply(qualityPrompt("audio", AUDIO_QUALITIES));

        // Listen for the user's quality selection using a message listener
        conn.on('message', async (msg) => {
            if (msg.from === from && !isNaN(msg.text.trim()) && parseInt(msg.text.trim()) >= 1 && parseInt(msg.text.trim()) <= AUDIO_QUALITIES.length) {
                let choice = parseInt(msg.text.trim());
                let selectedQuality = AUDIO_QUALITIES[choice - 1].value;
                await reply(`✅ *Selected Quality:* ${AUDIO_QUALITIES[choice - 1].label}`);

                await reply("🎶 *Streaming your song...* ⏳");

                let audioStream = ytdl(data.url, { quality: selectedQuality, filter: "audioonly" });
                await conn.sendMessage(from, { audio: { stream: audioStream }, mimetype: "audio/mpeg" }, { quoted: mek });

                await reply("✅ *Song uploaded!* 🎵");

                // Remove the message listener after the reply is processed
                conn.removeAllListeners('message');
            } else {
                // Optional: Handle invalid input
                await reply("🚫 *Invalid selection, please reply with a number corresponding to a valid quality.*");
            }
        });
    } catch (e) {
        reply(`🚫 *Error:* ${e.message}`);
    }
});

// ========== VIDEO DOWNLOADER ==========
cmd({
    pattern: "video",
    desc: "Download videos with quality selection",
    category: "download",
    react: "🎥",
    filename: __filename,
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🚫 *Provide a YouTube link or title!*");

        const search = await yts(q);
        const data = search.videos[0];
        if (!data) return reply("🚫 *No results found!*");

        let desc = `🎬 *SENAL MD VIDEO DOWNLOADER* 🎥\n\n` +
                   `📌 *Title:* ${data.title}\n` +
                   `👀 *Views:* ${data.views}\n` +
                   `📝 *Description:* ${data.description}\n` +
                   `⏳ *Duration:* ${data.timestamp}\n` +
                   `📅 *Uploaded:* ${data.ago}\n\n` +
                   `💠 *Powered by SENAL*`;

        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: desc }, { quoted: mek });
        await reply(qualityPrompt("video", VIDEO_QUALITIES));

        // Listen for the user's quality selection using a message listener
        conn.on('message', async (msg) => {
            if (msg.from === from && !isNaN(msg.text.trim()) && parseInt(msg.text.trim()) >= 1 && parseInt(msg.text.trim()) <= VIDEO_QUALITIES.length) {
                let choice = parseInt(msg.text.trim());
                let selectedQuality = VIDEO_QUALITIES[choice - 1].value;
                await reply(`✅ *Selected Quality:* ${VIDEO_QUALITIES[choice - 1].label}`);

                await reply("🎥 *Streaming your video...* ⏳");

                let videoStream = ytdl(data.url, { quality: selectedQuality });
                await conn.sendMessage(from, { video: { stream: videoStream }, mimetype: "video/mp4" }, { quoted: mek });

                await reply("✅ *Video uploaded!* 🎬");

                // Remove the message listener after the reply is processed
                conn.removeAllListeners('message');
            } else {
                // Optional: Handle invalid input
                await reply("🚫 *Invalid selection, please reply with a number corresponding to a valid quality.*");
            }
        });
    } catch (e) {
        reply(`🚫 *Error:* ${e.message}`);
    }
});
