const { ytmp4 } = require('@vreden/youtube_scraper');
const yts = require('yt-search');
const axios = require('axios');
const { cmd } = require('../command'); // your command handler

cmd({
  pattern: 'video2',
  desc: 'Download YouTube videos by name or URL',
  category: 'download',
  use: '.video <song name or link>',
  filename: __filename,
}, async (m, conn, text) => {
  try {
    const { from, quoted } = m;

    // Get search query
    const query = text || quoted?.text;
    if (!query) return m.reply('❌ කරුණාකර වීඩියෝවක් ලබාදෙන්න: *.video senura remix*');

    // Search with yt-search
    const search = await yts(query);
    const videoInfo = search.videos[0];
    if (!videoInfo) return m.reply('🚫 වීඩියෝවක් හමු නොවීය.');

    const url = videoInfo.url;
    const title = videoInfo.title;
    const duration = videoInfo.timestamp;
    const thumb = videoInfo.thumbnail;
    const views = videoInfo.views;

    // Get download link using youtube_scraper
    const download = await ytmp4(url, "360");
    if (!download.status || !download.download?.url) {
      return m.reply('🚫 වීඩියෝව බාගත කිරීම අසාර්ථක විය.');
    }

    // Download and stream video to WhatsApp
    const streamResponse = await axios.get(download.download.url, { responseType: 'stream' });

    await conn.sendMessage(from, {
      video: { stream: streamResponse.data },
      mimetype: 'video/mp4',
      caption: `🎬 *${title}*\n⏱️ ${duration} | 👁️ ${views.toLocaleString()}\n🔗 ${url}\n\n✅ *Powered by SENAL MD*`,
    }, { quoted: m });

  } catch (e) {
    console.error("Video Download Error:", e);
    m.reply('🚫 *වීඩියෝ බාගත කිරීමේදී දෝෂයක් ඇතිවිය.*');
  }
});
