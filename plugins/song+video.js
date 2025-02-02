const { cmd } = require('../command');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');

// YouTube URL Normalizer
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
        if (!q) return reply("*🚫 Please provide a YouTube link or title!*");

        const search = await yts(q);
        const data = search.videos[0];
        const url = normalizeYouTubeURL(data.url);

        if (!url) return reply("*🚫 Video not found!*");

        // Video details
        let desc = `╭━❮◆ SENAL MD SONG DOWNLOADER ◆❯━╮
┃➤✰ 𝚃𝙸𝚃𝙻𝙴 : ${data.title}
┃➤✰ 𝚅𝙸𝙴𝚆𝚂 : ${data.views}
┃➤✰ 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽 : ${data.description}
┃➤✰ 𝚃𝙸𝙼𝙴 : ${data.timestamp}
┃➤✰ 𝙰𝙶𝙾 : ${data.ago}
╰━━━━━━━━━━━━━━━⪼

> © Powered by SENAL`;

        // Send video details
        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: desc }, { quoted: mek });

        // Quality selection
        let buttons = AUDIO_QUALITIES.map((q, i) => ({
            buttonId: `audio_${i}`,
            buttonText: { displayText: `${i + 1} - ${q.label}` },
            type: 1
        }));

        let buttonMessage = {
            text: `🎧 *Select Audio Quality:*\n\n⚠️ *For songs, it's recommended to use 64kbps or 128kbps.*`,
            footer: "Powered by SENAL",
            buttons: buttons,
            headerType: 1
        };

        await conn.sendMessage(from, buttonMessage, { quoted: mek });

        // Listen for user's quality selection
        conn.on("message", async (msg) => {
            let choice = parseInt(msg.message.conversation.trim());
            if (isNaN(choice) || choice < 1 || choice > AUDIO_QUALITIES.length) {
                return reply("*🚫 Invalid choice!*");
            }

            let selectedQuality = AUDIO_QUALITIES[choice - 1].value;
            await reply("🎧 *Wait for your song...*");

            let audioStream = ytdl(url, { quality: selectedQuality, filter: "audioonly" });

            await conn.sendMessage(from, { audio: { stream: audioStream }, mimetype: "audio/mpeg" }, { quoted: mek });
            await reply("*✅ Uploaded!*");
        });

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
        if (!q) return reply("*🚫 Please provide a YouTube link or title!*");

        const search = await yts(q);
        const data = search.videos[0];
        const url = normalizeYouTubeURL(data.url);

        if (!url) return reply("*🚫 Video not found!*");

        // Video details
        let desc = `╭━❮◆ SENAL MD VIDEO DOWNLOADER ◆❯━╮
┃➤✰ 𝚃𝙸𝚃𝙻𝙴 : ${data.title}
┃➤✰ 𝚅𝙸𝙴𝚆𝚂 : ${data.views}
┃➤✰ 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽 : ${data.description}
┃➤✰ 𝚃𝙸𝙼𝙴 : ${data.timestamp}
┃➤✰ 𝙰𝙶𝙾 : ${data.ago}
╰━━━━━━━━━━━━━━━⪼

> © Powered by SENAL`;

        // Send video details
        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: desc }, { quoted: mek });

        // Quality selection
        let buttons = VIDEO_QUALITIES.map((q, i) => ({
            buttonId: `video_${i}`,
            buttonText: { displayText: `${i + 1} - ${q.label}` },
            type: 1
        }));

        let buttonMessage = {
            text: `🎬 *Select Video Quality:*\n\n⚠️ *For videos, it's recommended to use 360p or 144p.*`,
            footer: "Powered by SENAL",
            buttons: buttons,
            headerType: 1
        };

        await conn.sendMessage(from, buttonMessage, { quoted: mek });

        // Listen for user's quality selection
        conn.on("message", async (msg) => {
            let choice = parseInt(msg.message.conversation.trim());
            if (isNaN(choice) || choice < 1 || choice > VIDEO_QUALITIES.length) {
                return reply("*🚫 Invalid choice!*");
            }

            let selectedQuality = VIDEO_QUALITIES[choice - 1].value;
            await reply
::contentReference[oaicite:0]{index=0}
 
