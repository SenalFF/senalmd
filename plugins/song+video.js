const { cmd } = require('../command');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');

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

// Quality prompt function for audio and video
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

        // Listen for the user's response with a 5-minute timeout
        let timeout = setTimeout(() => {
            reply("🚫 *Timed out!* Please try again.");
        }, 300000);  // 5 minutes timeout

        conn.on('message', async (msg) => {
            if (msg.from === from && !isNaN(parseInt(msg.message.conversation.trim()))) {
                clearTimeout(timeout);  // Clear the timeout when a response is received

                let choice = parseInt(msg.message.conversation.trim());
                if (choice < 1 || choice > AUDIO_QUALITIES.length) {
                    return reply("🚫 *Invalid choice!* Please send a valid number.");
                }

                let selectedQuality = AUDIO_QUALITIES[choice - 1].value;
                await reply(`✅ *Selected Quality:* ${AUDIO_QUALITIES[choice - 1].label}`);

                await reply("🎶 *Streaming your song...* ⏳");

                let audioStream = ytdl(data.url, { quality: selectedQuality, filter: "audioonly" });
                await conn.sendMessage(from, { audio: { stream: audioStream }, mimetype: "audio/mpeg" }, { quoted: mek });

                await reply("✅ *Song uploaded!* 🎵");
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

        // Listen for the user's response with a 5-minute timeout
        let timeout = setTimeout(() => {
            reply("🚫 *Timed out!* Please try again.");
        }, 300000);  // 5 minutes timeout

        conn.on('message', async (msg) => {
            if (msg.from === from && !isNaN(parseInt(msg.message.conversation.trim()))) {
                clearTimeout(timeout);  // Clear the timeout when a response is received

                let choice = parseInt(msg.message.conversation.trim());
                if (choice < 1 || choice > VIDEO_QUALITIES.length) {
                    return reply("🚫 *Invalid choice!* Please send a valid number.");
                }

                let selectedQuality = VIDEO_QUALITIES[choice - 1].value;
                await reply(`✅ *Selected Quality:* ${VIDEO_QUALITIES[choice - 1].label}`);

                await reply("🎥 *Streaming your video...* ⏳");

                let videoStream = ytdl(data.url, { quality: selectedQuality });
                await conn.sendMessage(from, { video: { stream: videoStream }, mimetype: "video/mp4" }, { quoted: mek });

                await reply("✅ *Video uploaded!* 🎬");
            }
        });

    } catch (e) {
        reply(`🚫 *Error:* ${e.message}`);
    }
});
