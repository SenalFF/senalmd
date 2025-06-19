const { cmd } = require('../command'); // ✅ Corrected path
const yts = require('@vreden/youtube_scraper');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const axios = require('axios');

ffmpeg.setFfmpegPath(ffmpegPath);

cmd({
  pattern: "video",
  desc: "Download video from YouTube",
  category: "download",
  react: "🎥",
  filename: __filename,
}, async (conn, mek, m, { q, reply, from }) => {
  try {
    if (!q) return reply("*කරුණාකර Link එකක් හෝ නමක් ලබා දෙන්න 🔎...*");

    const query = q.startsWith('http') ? q : `ytsearch:${q}`;
    const result = await yts(query);
    const data = result.videos[0];
    if (!data || !data.url) return reply("*🚫 සොයාගත නොහැක!*");

    const description = `╭━❮◆ SENAL MD VIDEO DOWNLOADER ◆❯━╮
┃➤✰ 𝚃𝙸𝚃𝙻𝙴 : ${data.title}
┃➤✰ 𝚅𝙸𝙴𝚆𝚂 : ${data.views}
┃➤✰ 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽 : ${data.description}
┃➤✰ 𝚃𝙸𝙼𝙴 : ${data.timestamp}
┃➤✰ 𝙰𝙶𝙾 : ${data.ago}
╰━━━━━━━━━━━━━━━⪼

© ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝚂𝙴𝙽𝙰𝙻`;

    await conn.sendMessage(from, {
      image: { url: data.thumbnail },
      caption: description,
    }, { quoted: mek });

    await reply("*_Downloading and converting..._ ⏳*");

    const response = await axios({
      url: data.url,
      method: 'GET',
      responseType: 'stream',
    });

    const chunks = [];
    const stream = ffmpeg(response.data)
      .format('webm')
      .videoCodec('libvpx')
      .audioCodec('libvorbis')
      .on('error', (err) => reply(`❌ FFmpeg Error: ${err.message}`))
      .on('end', async () => {
        const buffer = Buffer.concat(chunks);
        await conn.sendMessage(from, {
          video: buffer,
          mimetype: 'video/webm',
          fileName: `${data.title}.webm`,
          caption: "© 𝚂𝙴𝙽𝙰𝙻 𝙼𝙳 | Converted & Sent 🎥",
        }, { quoted: mek });

        await reply("*_UPLOADED ✅_*");
      })
      .pipe();

    stream.on('data', chunk => chunks.push(chunk));

  } catch (err) {
    console.error("Error in video command:", err);
    reply(`🚫 *දෝෂයක් ඇති විය:*\n${err.message}`);
  }
});
