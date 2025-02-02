const { cmd, commands } = require('../command');
const ytdl = require('ytdl-core');
const yts = require('yt-search');

/**
 * Normalize YouTube URL
 * Converts shortened YouTube URLs (https://youtu.be/...) to standard format.
 */
const normalizeYouTubeURL = (url) => {
    if (url.startsWith('https://youtu.be/')) {
        const videoId = url.split('/').pop().split('?')[0];
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return url;
};

//=========== SONG DOWNLOAD ===========

cmd({
    pattern: "song",
    desc: "Download songs",
    category: "download",
    react: "🎵",
    filename: __filename,
},
async (conn, mek, m, {
    from, quoted, args, q, reply
}) => {
    try {
        if (!q) return reply("*කරුණාකර Link එකක් හෝ නමක් ලබා දෙන්න 🔎...*");

        const normalizedQuery = q.startsWith('http') ? normalizeYouTubeURL(q) : q;
        const search = await yts(normalizedQuery);
        const data = search.videos[0];
        const url = data.url;

        if (!url) return reply("*🚫 සොයාගත නොහැක!*");

        let desc = `╭━❮◆ SENAL MD SONG DOWNLOADER ◆❯━╮
┃➤✰ 𝚃𝙸𝚃𝙻𝙴 : ${data.title}
┃➤✰ 𝚅𝙸𝙴𝚆𝚂 : ${data.views}
┃➤✰ 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽 : ${data.description}
┃➤✰ 𝚃𝙸𝙼𝙴 : ${data.timestamp}
┃➤✰ 𝙰𝙶𝙾 : ${data.ago}
╰━━━━━━━━━━━━━━━⪼

> ©ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝚂𝙴𝙽𝙰𝙻`;

        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: desc }, { quoted: mek });
        await reply("*_Downloading_* ⬇️");

        const audioStream = ytdl(url, { filter: 'audioonly', format: 'mp3' });

        await conn.sendMessage(from, { audio: { stream: audioStream }, mimetype: "audio/mpeg" }, { quoted: mek });
        await reply("*_UPLOADED_* ✅");
    } catch (e) {
        reply(`🚫 *දෝෂයක් ඇති විය:*\n${e}`);
    }
});

//=========== VIDEO DOWNLOAD ===========

cmd({
    pattern: "video",
    desc: "Download video",
    category: "download",
    react: "🎥",
    filename: __filename,
},
async (conn, mek, m, {
    from, quoted, args, q, reply
}) => {
    try {
        if (!q) return reply("*කරුණාකර Link එකක් හෝ නමක් ලබා දෙන්න 🔎...*");

        const normalizedQuery = q.startsWith('http') ? normalizeYouTubeURL(q) : q;
        const search = await yts(normalizedQuery);
        const data = search.videos[0];
        const url = data.url;

        if (!url) return reply("*🚫 සොයාගත නොහැක!*");

        let des = `╭━❮◆ SENAL MD VIDEO DOWNLOADER ◆❯━╮
┃➤✰ 𝚃𝙸𝚃𝙻𝙴 : ${data.title}
┃➤✰ 𝚅𝙸𝙴𝚆𝚂 : ${data.views}
┃➤✰ 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽 : ${data.description}
┃➤✰ 𝚃𝙸𝙼𝙴 : ${data.timestamp}
┃➤✰ 𝙰𝙶𝙾 : ${data.ago}
╰━━━━━━━━━━━━━━━⪼

> ©ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝚂𝙴𝙽𝙰𝙻`;

        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: des }, { quoted: mek });
        await reply("*_Downloading_* ⬇️");

        const videoStream = ytdl(url, { filter: 'videoandaudio', format: 'mp4' });

        await conn.sendMessage(from, { video: { stream: videoStream }, mimetype: "video/mp4" }, { quoted: mek });
        await reply("*_UPLOADED_* ✅");
    } catch (a) {
        reply(`🚫 *දෝෂයක් ඇති විය:*\n${a}`);
    }
});
