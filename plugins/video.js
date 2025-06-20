const { cmd } = require('../command');
const { ytmp4 } = require('@vreden/youtube_scraper');
const yts = require('yt-search');
const axios = require('axios');
const { PassThrough } = require('stream');

cmd({
  pattern: "video2",
  desc: "Download YouTube video",
  category: "download",
  react: "🎥",
  filename: __filename,
}, async (conn, mek, m, { q, reply, from }) => {
  try {
    if (!q) return reply("*🔎 කරුණාකර Link එකක් හෝ නමක් ලබා දෙන්න...*");

    // Search YouTube video
    const search = await yts(q);
    const videoInfo = search.videos[0];
    if (!videoInfo || !videoInfo.url) return reply("🚫 *වීඩියෝව සොයාගත නොහැක!*");

    // Get video download link (360p default)
    const download = await ytmp4(videoInfo.url, "360");
    if (!download.status || !download.download?.url) {
      return reply("❌ *වීඩියෝ බාගත කළ නොහැක!*");
    }

    // Stylish message
    const caption = `╭━❮◆ *SENAL MD VIDEO DOWNLOADER* ◆❯━╮
┃➤✰ 𝚃𝙸𝚃𝙻𝙴 : ${videoInfo.title}
┃➤✰ 𝚅𝙸𝙴𝚆𝚂 : ${videoInfo.views}
┃➤✰ 𝙳𝚄𝚁𝙰𝚃𝙸𝙾𝙽 : ${videoInfo.timestamp}
┃➤✰ 𝙿𝚄𝙱𝙻𝙸𝚂𝙷𝙴𝙳 : ${videoInfo.ago}
╰━━━━━━━━━━━━━━━⪼

© ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝚂𝙴𝙽𝙰𝙻`;

    await conn.sendMessage(from, {
      image: { url: videoInfo.thumbnail },
      caption,
    }, { quoted: mek });

    await reply("*📥 බාගත කරමින් පවතී...*");

    // Stream video to WhatsApp
    const stream = new PassThrough();
    axios({
      method: 'get',
      url: download.download.url,
      responseType: 'stream',
    }).then(res => {
      res.data.pipe(stream);

      conn.sendMessage(from, {
        video: stream,
        mimetype: 'video/mp4',
        caption: `🎬 ${videoInfo.title}\n\n✅ *Powered by SENAL MD*`,
      }, { quoted: mek });
    }).catch(err => {
      console.error(err);
      reply("🚫 *වීඩියෝ Stream කිරීමේදී දෝෂයකි!*");
    });

  } catch (err) {
    console.error("Video Download Error:", err);
    reply(`❌ *දෝෂයක් ඇතිවීය:*\n${err.message}`);
  }
});
