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

// Function to generate quality selection message
const qualityPrompt = (type, qualities) => {
    let msg = `⚠️ *Select a ${type} quality by sending a number:*\n\n`;
    qualities.forEach((q, i) => {
        msg += `*${i + 1} - ${q.label}*\n`;
    });
    return msg + `\n🚨 *Reply with the number!*`;
};

// Function to listen for user response
async function waitForResponse(sock, from, validOptions, timeout = 60000) {
    return new Promise((resolve) => {
        const handleMessage = async (upsert) => {
            const messages = upsert.messages;
            if (!messages || messages.length === 0) return;

            const msg = messages[0];
            if (!msg.key || !msg.key.remoteJid) return;

            if (msg.key.remoteJid === from && msg.message?.conversation) {
                let text = msg.message.conversation.trim();
                let choice = parseInt(text);

                if (!isNaN(choice) && choice >= 1 && choice <= validOptions.length) {
                    sock.ev.off('messages.upsert', handleMessage); // Stop listening
                    resolve(validOptions[choice - 1].value);
                }
            }
        };

        sock.ev.on('messages.upsert', handleMessage); // Listen for messages

        // Timeout handler
        setTimeout(() => {
            sock.ev.off('messages.upsert', handleMessage); // Stop listening
            resolve(null);
        }, timeout);
    });
}

// ========== SONG DOWNLOADER ==========
cmd({
    pattern: "song",
    desc: "Download songs with quality selection",
    category: "download",
    react: "🎵",
    filename: __filename,
},
async (sock, mek, m, { from, q, reply }) => {
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

        await sock.sendMessage(from, { image: { url: data.thumbnail }, caption: desc }, { quoted: mek });
        await reply(qualityPrompt("audio", AUDIO_QUALITIES));

        // Wait for user response
        let selectedQuality = await waitForResponse(sock, from, AUDIO_QUALITIES);
        if (!selectedQuality) return reply("🚫 *Timed out!* Please try again.");

        await reply(`✅ *Selected Quality:* ${selectedQuality}`);
        await reply("🎶 *Downloading your song...* ⏳");

        let audioStream = ytdl(data.url, { quality: selectedQuality, filter: "audioonly" });
        await sock.sendMessage(from, { audio: { stream: audioStream }, mimetype: "audio/mpeg" }, { quoted: mek });

        await reply("✅ *Song uploaded!* 🎵");
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
async (sock, mek, m, { from, q, reply }) => {
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

        await sock.sendMessage(from, { image: { url: data.thumbnail }, caption: desc }, { quoted: mek });
        await reply(qualityPrompt("video", VIDEO_QUALITIES));

        // Wait for user response
        let selectedQuality = await waitForResponse(sock, from, VIDEO_QUALITIES);
        if (!selectedQuality) return reply("🚫 *Timed out!* Please try again.");

        await reply(`✅ *Selected Quality:* ${selectedQuality}`);
        await reply("🎥 *Downloading your video...* ⏳");

        let videoStream = ytdl(data.url, { quality: selectedQuality });
        await sock.sendMessage(from, { video: { stream: videoStream }, mimetype: "video/mp4" }, { quoted: mek });

        await reply("✅ *Video uploaded!* 🎬");
    } catch (e) {
        reply(`🚫 *Error:* ${e.message}`);
    }
});
