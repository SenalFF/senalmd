const { cmd } = require('../command');
const yts = require('yt-search');
const { ytmp4 } = require('@vreden/youtube_scraper');

cmd({
  pattern: "video2",
  desc: "Download YouTube video by name or link",
  category: "download",
  react: "📽️",
  filename: __filename,
}, async (conn, mek, m, { q, reply, from }) => {
  try {
    if (!q) return reply("*⚠️ කරුණාකර වීඩියෝ නමක් හෝ ලින්ක් එකක් ලබා දෙන්න!*");

    const isUrl = q.startsWith('http://') || q.startsWith('https://');
    let videoInfo, download;

    if (isUrl) {
      download = await ytmp4(q, '360');
      if (!download.status) return reply("🚫 *වීඩියෝව බාගත කළ නොහැක!*");
      videoInfo = download.metadata;
    } else {
      const search = await yts(q);
      if (!search.videos.length) return reply("❌ *වීඩියෝව සොයාගත නොහැක!*");

      const vid = search.videos[0];
      const link = vid.url;

      download = await ytmp4(link, '360');
      if (!download.status) return reply("🚫 *වීඩියෝව බාගත කළ නොහැක!*");

      videoInfo = download.metadata;
    }

    const caption = `╭━❮◆ SENAL MD VIDEO DOWNLOADER ◆❯━╮
┃🎬 *Title:* ${videoInfo.title}
┃📺 *Channel:* ${videoInfo.channel}
┃⏱️ *Duration:* ${videoInfo.duration}
┃📥 *Quality:* ${download.quality}
┃⚡ *Powered by:* SENAL MD
╰━━━━━━━━━━━━━━━━━━━━━━━⪼`;

    await conn.sendMessage(from, {
      image: { url: videoInfo.thumbnail },
      caption,
    }, { quoted: mek });

    await reply("*⏳ Downloading video... Please wait!*");

    await conn.sendMessage(from, {
      video: { url: download.download },
      mimetype: 'video/mp4',
      caption: `🎬 ${videoInfo.title}\n\n✅ Powered by SENAL MD`,
    }, { quoted: mek });

  } catch (err) {
    console.error("Video Download Error:", err);
    reply("🚫 *දෝෂයක් ඇති විය. කරුණාකර නැවත උත්සහ කරන්න!*");
  }
});
