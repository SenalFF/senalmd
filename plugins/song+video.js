const { cmd } = require('../command');
const yts = require('yt-search');
const ytdl = require('@l);

const AUDIO_QUALITIES = [
    { label: "64kbps", id: "lowestaudio" },
    { label: "128kbps", id: "audioonly" },
    { label: "192kbps", id: "highestaudio" }
];

const VIDEO_QUALITIES = [
    { label: "144p", id: "tiny" },
    { label: "360p", id: "lowest" },
    { label: "480p", id: "medium" },
    { label: "720p", id: "highest" }
];

const createButtons = (type, qualities, q, prefix) => {
    return qualities.map((qObj) => ({
        type: "reply",
        reply: {
            id: `${prefix}${type === "audio" ? "ta" : "tv"} ${q} ${qObj.id}`,
            title: qObj.label
        }
    }));
};

// ========== SONG DOWNLOADER ==========
cmd({
    pattern: "",
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

        let buttons = createButtons("audio", AUDIO_QUALITIES, q, prefix);

        let message = {
            interactive: {
                type: "button",
                body: { text: desc },
                footer: { text: "🔹 Select a quality below" },
                action: {
                    buttons: buttons
                }
            }
        };

        return await sock.sendMessage(from, message, { quoted: mek });
    } catch (e) {
        console.log(e);
        reply(`🚫 *Error:* ${e.message}`);
    }
});

// ========== VIDEO DOWNLOADER ==========
cmd({
    pattern: "",
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

        let buttons = createButtons("video", VIDEO_QUALITIES, q, prefix);

        let message = {
            interactive: {
                type: "button",
                body: { text: desc },
                footer: { text: "🔹 Select a quality below" },
                action: {
                    buttons: buttons
                }
            }
        };

        return await sock.sendMessage(from, message, { quoted: mek });
    } catch (e) {
        console.log(e);
        reply(`🚫 *Error:* ${e.message}`);
    }
});
