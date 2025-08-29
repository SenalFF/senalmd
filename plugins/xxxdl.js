const axios = require("axios");
const cheerio = require("cheerio");
const sharp = require("sharp");
const { cmd } = require("../command");

const MAX_WHATSAPP_SIZE = 64 * 1024 * 1024; // 64 MB

// Helper: fetch HTML
async function fetchHTML(url) {
  const res = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36"
    },
    timeout: 20000
  });
  return res.data;
}

// Search command with working thumbnail previews
cmd({
  pattern: "xvid",
  react: "🔞",
  desc: "Search xHamster videos by query",
  category: "adult",
  use: ".xhamster <query>",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    const query = args.join(" ").trim();
    if (!query) return reply("⚡ Query එකක් දෙන්න.\nඋදා: *.xhsearch indian milf*");

    await reply("🔎 Searching xHamster...");

    const searchUrl = `https://xhamster.com/search/${encodeURIComponent(query)}`;
    const html = await fetchHTML(searchUrl);
    const $ = cheerio.load(html);

    const videos = [];

    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const title = $(el).attr('title') || $(el).text();
      const thumb = $(el).find('img').attr('src') || $(el).attr('data-thumb');

      if (!href || !/\/videos?\/[a-z0-9-]+/i.test(href)) return;

      const full = href.startsWith('http') ? href : `https://xhamster.com${href}`;
      videos.push({ url: full, title: title.trim(), thumb });
    });

    if (videos.length === 0) return reply("❌ Search results හමු නොවුණා.");

    // Limit to 5 results to avoid flooding
    const limit = Math.min(5, videos.length);
    for (let i = 0; i < limit; i++) {
      const vid = videos[i];
      const caption = `*${i + 1}.* ${vid.title}\n🔗 ${vid.url}\n➡️ Use: *.xhamsterdl <video link>*`;

      if (vid.thumb) {
        try {
          // Fetch thumbnail as arraybuffer
          const tRes = await axios.get(vid.thumb, { responseType: "arraybuffer", headers: { 'User-Agent': 'Mozilla/5.0' } });

          // Convert to JPEG to ensure WhatsApp compatibility
          const jpegBuffer = await sharp(Buffer.from(tRes.data)).jpeg().toBuffer();

          // Send thumbnail as WhatsApp image
          await conn.sendMessage(mek.chat, {
            image: { buffer: jpegBuffer },
            caption
          }, { quoted: mek });
          continue;
        } catch (e) {
          console.error("Thumbnail fetch/convert error:", e);
        }
      }

      // Fallback text message if thumbnail unavailable
      await reply(caption);
    }

    if (videos.length > 5) {
      await reply(`ℹ️ More results available. Refine your search or download using the above links.`);
    }

  } catch (err) {
    console.error("xhsearch error:", err);
    reply("❌ Search එකට දෝෂයක්. ටිකක් පසුව නැවත උත්සහ කරන්න.");
  }
});

// Download command remains unchanged
cmd({
  pattern: "xviddl",
  react: "⬇️",
  desc: "Download xHamster video by URL",
  category: "adult",
  use: ".xhamsterdl <xhamster video link>",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    let url = args[0];
    if (!url) return reply("⚡ Link එකක් දෙන්න.\nඋදා: *.xhvideo https://xhamster.com/videos/slug-123456*");

    if (!url.startsWith("http")) url = `https://${url}`;

    await reply("⏳ Fetching video page...");

    const html = await fetchHTML(url);

    let title = (html.match(/<meta property="og:title" content="([^"]+)"/i) || [])[1] || "";
    let thumb = (html.match(/<meta property="og:image" content="([^"]+)"/i) || [])[1] || undefined;
    if (!title) {
      const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = t ? t[1].trim() : "xhamster_video";
    }

    const mp4Regex = /https?:\/\/[^"'()\s]+\.mp4[^"'()\s]*/gi;
    const found = [];
    let mmp;
    while ((mmp = mp4Regex.exec(html)) !== null) {
      found.push(mmp[0]);
    }

    if (found.length === 0) {
      const cfgRegex = /"videoUrl"\s*:\s*"([^"]+\.mp4[^"]*)"/i;
      const cfg = html.match(cfgRegex);
      if (cfg && cfg[1]) found.push(cfg[1].replace(/\\u0026/g, '&').replace(/\\/g, ''));
    }

    const unique = Array.from(new Set(found));
    if (unique.length === 0) return reply("❌ Direct MP4 link හමු නොවුණා. Manual open කරන්න: " + url);

    unique.sort((a, b) => {
      const qa = /1080|720|480|360/.exec(a) || [];
      const qb = /1080|720|480|360/.exec(b) || [];
      if (qa.length && !qb.length) return -1;
      if (!qa.length && qb.length) return 1;
      return b.length - a.length;
    });

    const videoUrl = unique[0];

    let fileSize = 0;
    try {
      const head = await axios.head(videoUrl, { timeout: 15000 });
      fileSize = parseInt(head.headers['content-length'] || "0");
    } catch (e) {}

    const safeTitle = title.replace(/[^a-zA-Z0-9 ]/g, "_").slice(0, 64);
    const fileName = `${safeTitle}.mp4`;
    const caption = `🔞 *${title}*`;

    if (fileSize && fileSize > MAX_WHATSAPP_SIZE) {
      let msg = `⚠️ File size is too large for WhatsApp (${(fileSize / (1024*1024)).toFixed(2)} MB).\nDownload manually:\n${videoUrl}`;
      await conn.sendMessage(mek.chat, { text: msg }, { quoted: mek });
      return;
    }

    const sendObj = {
      document: { url: videoUrl },
      mimetype: "video/mp4",
      fileName: fileName,
      caption: caption
    };

    if (thumb) {
      try {
        const tRes = await axios.get(thumb, { responseType: "arraybuffer", headers: { 'User-Agent': 'Mozilla/5.0' } });
        const jpegThumb = await sharp(Buffer.from(tRes.data)).jpeg().toBuffer();
        sendObj.jpegThumbnail = jpegThumb;
      } catch {}
    }

    await conn.sendMessage(mek.chat, sendObj, { quoted: mek });

  } catch (err) {
    console.error("xhvideo error:", err);
    reply("❌ Video download/process එකේ දෝෂයක්. Link එක හරියෙන් තියෙනවද බලන්න.");
  }
});
