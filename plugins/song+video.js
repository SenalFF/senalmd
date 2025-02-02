const { cmd } = require('../command');
const ytdl = require('ytdl-core');
const yts = require('yt-search');

const normalizeYouTubeURL = (url) => {
    if (url.startsWith('https://youtu.be/')) {
        const videoId = url.split('/').pop().split('?')[0];
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return url;
};

//=========== SONG DOWNLOADER ===========
cmd({
    pattern: "song",
    desc: "Download songs",
    category: "download",
    react: "🎵",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("*🔎 Please provide a song name or YouTube link!*");

        const searchQuery = q.startsWith('http') ? normalizeYouTubeURL(q) : q;
        const search = await yts(searchQuery);
        const data = search.videos[0];

        if (!data) return reply("*🚫 No results found!*");

        const url = data.url;
        const info = await ytdl.getInfo(url);
        const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });

        if (!audioFormat || !audioFormat.url) return reply("*🚫 Unable to get audio link!*");

        let desc = `╭━❮◆ SENAL MD SONG DOWNLOADER ◆❯━╮
┃➤✰ 𝚃𝙸𝚃𝙻𝙴 : ${data.title}
┃➤✰ 𝚅𝙸𝙴𝚆𝚂 : ${data.views}
┃➤✰ 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽 : ${data.description}
┃➤✰ 𝚃𝙸𝙼𝙴 : ${data.timestamp}
┃➤✰ 𝙰𝙶𝙾 : ${data.ago}
╰━━━━━━━━━━━━━━━⪼
> © Powered by SENAL`;

        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: desc }, { quoted: mek });
        await reply("*⬇️ Downloading song...*");

        await conn.sendMessage(from, { audio: { url: audioFormat.url }, mimetype: "audio/mpeg" }, { quoted: mek });

        await reply("*✅ Song sent successfully!*");
    } catch (e) {
        reply(`🚫 *Error occurred:*\n${e}`);
    }
});

//=========== VIDEO DOWNLOADER ===========
cmd({
    pattern: "video",
    desc: "Download videos",
    category: "download",
    react: "🎥",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("*🔎 Please provide a video name or YouTube link!*");

        const searchQuery = q.startsWith('http') ? normalizeYouTubeURL(q) : q;
        const search = await yts(searchQuery);
        const data = search.videos[0];

        if (!data) return reply("*🚫 No results found!*");

        const url = data.url;
        const info = await ytdl.getInfo(url);
        const videoFormat = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });

        if (!videoFormat || !videoFormat.url) return reply("*🚫 Unable to get video link!*");

        let des = `╭━❮◆ SENAL MD VIDEO DOWNLOADER ◆❯━╮
┃➤✰ 𝚃𝙸𝚃𝙻𝙴 : ${data.title}
┃➤✰ 𝚅𝙸𝙴𝚆𝚂 : ${data.views}
┃➤✰ 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽 : ${data.description}
┃➤✰ 𝚃𝙸𝙼𝙴 : ${data.timestamp}
┃➤✰ 𝙰𝙶𝙾 : ${data.ago}
╰━━━━━━━━━━━━━━━⪼
> © Powered by SENAL`;

        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: des }, { quoted: mek });
        await reply("*⬇️ Downloading video...*");

        await conn.sendMessage(from, { video: { url: videoFormat.url }, mimetype: "video/mp4" }, { quoted: mek });

        await reply("*✅ Video sent successfully!*");
    } catch (e) {
        reply(`🚫 *Error occurred:*\n${e}`);
    }
});
