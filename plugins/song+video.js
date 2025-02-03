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

        let desc = `╭━❮◆ SENAL MD SONG DOWNLOADER ◆❯━╮
┃➤✰ *TITLE:* ${data.title}
┃➤✰ *VIEWS:* ${data.views}
┃➤✰ *DESCRIPTION:* ${data.description}
┃➤✰ *DURATION:* ${data.timestamp}
┃➤✰ *UPLOADED:* ${data.ago}
╰━━━━━━━━━━━━━━━⪼

> © Powered by SENAL`;

        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: desc }, { quoted: mek });

        let qualityButtons = AUDIO_QUALITIES.map((q, i) => ({
            buttonId: `audio_${i}`,
            buttonText: { displayText: `${i + 1} - ${q.label}` },
            type: 1
        }));

        let buttonMessage = {
            text: `🎧 *Select Audio Quality:*\n\n⚠️ *Recommended: 64kbps or 128kbps.*`,
            footer: "Powered by SENAL",
            buttons: qualityButtons,
            headerType: 1
        };

        await conn.sendMessage(from, buttonMessage, { quoted: mek });

        conn.once("message", async (msg) => {
            let choice = parseInt(msg.message.conversation.trim());
            if (isNaN(choice) || choice < 1 || choice > AUDIO_QUALITIES.length) {
                return reply("🚫 *Invalid choice!*");
            }

            let selectedQuality = AUDIO_QUALITIES[choice - 1].value;
            await reply("🎧 *Downloading your song...*");

            let audioStream = ytdl(url, { quality: selectedQuality, filter: "audioonly" });

            await conn.sendMessage(from, { audio: { stream: audioStream }, mimetype: "audio/mpeg" }, { quoted: mek });
            await reply("✅ *Song sent successfully!*");
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
        if (!q) return reply("🚫 *Please provide a YouTube link or title!*");

        const search = await yts(q);
        const data = search.videos[0];
        const url = normalizeYouTubeURL(data.url);

        if (!url) return reply("🚫 *Video not found!*");

        let desc = `╭━❮◆ SENAL MD VIDEO DOWNLOADER ◆❯━╮
┃➤✰ *TITLE:* ${data.title}
┃➤✰ *VIEWS:* ${data.views}
┃➤✰ *DESCRIPTION:* ${data.description}
┃➤✰ *DURATION:* ${data.timestamp}
┃➤✰ *UPLOADED:* ${data.ago}
╰━━━━━━━━━━━━━━━⪼

> © Powered by SENAL`;

        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: desc }, { quoted: mek });

        let qualityButtons = VIDEO_QUALITIES.map((q, i) => ({
            buttonId: `video_${i}`,
            buttonText: { displayText: `${i + 1} - ${q.label}` },
            type: 1
        }));

        let buttonMessage = {
            text: `🎬 *Select Video Quality:*\n\n⚠️ *Recommended: 360p or 144p.*`,
            footer: "Powered by SENAL",
            buttons: qualityButtons,
            headerType: 1
        };

        await conn.sendMessage(from, buttonMessage, { quoted: mek });

        conn.once("message", async (msg) => {
            let choice = parseInt(msg.message.conversation.trim());
            if (isNaN(choice) || choice < 1 || choice > VIDEO_QUALITIES.length) {
                return reply("🚫 *Invalid choice!*");
            }

            let selectedQuality = VIDEO_QUALITIES[choice - 1].value;
            await reply("🎬 *Downloading your video...*");

            let videoStream = ytdl(url, { quality: selectedQuality, filter: "videoandaudio" });

            await conn.sendMessage(from, { video: { stream: videoStream }, mimetype: "video/mp4" }, { quoted: mek });
            await reply("✅ *Video sent successfully!*");
        });

    } catch (e) {
        reply(`🚫 *Error:* ${e}`);
    }
});
