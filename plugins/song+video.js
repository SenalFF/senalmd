const { cmd } = require('../command');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');

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

const qualityPrompt = (type, qualities) => {
    let msg = `⚠️ *Select a ${type} quality by clicking a button:*\n\n`;
    qualities.forEach((q, i) => {
        msg += `*${i + 1} - ${q.label}*\n`;
    });
    return msg;
};

// Function to create buttons dynamically
const createQualityButtons = (prefix, type, qualities, query) => {
    return qualities.map((q, i) => ({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
            display_text: q.label,
            id: `${prefix}${type === "audio" ? "ta" : "tv"} ${query} ${q.value}`
        })
    }));
};

// ========== SONG DOWNLOADER ==========
cmd({
    pattern: "song",
    desc: "Download songs with quality selection",
    category: "download",
    react: "🎵",
    filename: __filename,
},
async (sock, mek, m, { from, q, prefix, reply }) => {
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

        let buttons = createQualityButtons(prefix, "audio", AUDIO_QUALITIES, q);
        let opts = {
            header: '',
            footer: `🔹 Select quality below`,
            body: desc,
            image: { url: data.thumbnail }
        };

        return await sock.sendMessage(from, { buttonsMessage: { buttons, ...opts } }, { quoted: mek });
    } catch (e) {
        console.log(e);
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
async (sock, mek, m, { from, q, prefix, reply }) => {
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

        let buttons = createQualityButtons(prefix, "video", VIDEO_QUALITIES, q);
        let opts = {
            header: '',
            footer: `🔹 Select quality below`,
            body: desc,
            image: { url: data.thumbnail }
        };

        return await sock.sendMessage(from, { buttonsMessage: { buttons, ...opts } }, { quoted: mek });
    } catch (e) {
        console.log(e);
        reply(`🚫 *Error:* ${e.message}`);
    }
});
