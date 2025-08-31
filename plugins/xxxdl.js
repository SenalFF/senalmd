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

// ==================== 🔎 SEARCH COMMAND ====================
cmd({
  pattern: "xvid",
  react: "🔞",
  desc: "Search xHamster videos by query",
  category: "adult",
  use: ".xvid <query>",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    const query = args.join(" ").trim();
    if (!query) return reply("⚡ Query එකක් දෙන්න.\nඋදා: *.xvid indian milf*");

    await reply("🔎 Searching xHamster...");

    const searchUrl = `https://xhamster.com/search/${encodeURIComponent(query)}`;
    const html = await fetchHTML(searchUrl);
    const $ = cheerio.load(html);

    const videos = [];

    $("a").each((i, el) => {
      const href = $(el).attr("href");
      const title = $(el).attr("title") || $(el).text();
      const thumb = $(el).find("img").attr("src") || $(el).attr("data-thumb");

      if (!href || !/\/videos?\/[a-z0-9-]+/i.test(href)) return;

      const full = href.startsWith("http") ? href : `https://xhamster.com${href}`;
      videos.push({ url: full, title: title.trim(), thumb });
    });

    if (videos.length === 0) return reply("❌ Search results හමු නොවුණා.");

    // Limit results
    const limit = Math.min(5, videos.length);
    for (let i = 0; i < limit; i++) {
      const vid = videos[i];
      const caption = `*${i + 1}.* ${vid.title}\n🔗 ${vid.url}\n➡️ Use: *.xviddl ${vid.url}*`;

      if (vid.thumb) {
        try {
          const tRes = await axios.get(vid.thumb, { responseType: "arraybuffer" });
          const jpegBuffer = await sharp(Buffer.from(tRes.data)).jpeg().toBuffer();

          await conn.sendMessage(mek.chat, {
            image: { buffer: jpegBuffer },
            caption
          }, { quoted: mek });
          continue;
        } catch (e) {
          console.error("Thumbnail fetch/convert error:", e);
        }
      }

      // fallback text
      await reply(caption);
    }

    if (videos.length > 5) {
      await reply("ℹ️ More results available. Refine your search.");
    }

  } catch (err) {
    console.error("xvid search error:", err);
    reply("❌ Search එකේ දෝෂයක්. ටිකක් පසුව නැවත උත්සහ කරන්න.");
  }
});

// ==================== ⬇️ DOWNLOAD COMMAND ====================
cmd({
  pattern: "xviddl",
  react: "⬇️",
  desc: "Download xHamster video by URL",
  category: "adult",
  use: ".xviddl <xhamster video link>",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    let url = args[0];
    if (!url) return reply("⚡ Link එකක් දෙන්න.\nඋදා: *.xviddl https://xhamster.com/videos/...*");

    if (!url.startsWith("http")) url = `https://${url}`;
    await reply("⏳ Fetching video page...");

    const html = await fetchHTML(url);

    // Title + thumbnail
    let title = (html.match(/<meta property="og:title" content="([^"]+)"/i) || [])[1] || "xhamster_video";
    let thumb = (html.match(/<meta property="og:image" content="([^"]+)"/i) || [])[1];

    // JSON extraction (supports both formats)
    let jsonMatch = html.match(/window\.initials\s*=\s*({.*?});/s);
    if (!jsonMatch) {
      jsonMatch = html.match(/<script[^>]+id="initials-script"[^>]*>(.*?)<\/script>/s);
    }

    if (!jsonMatch) return reply("❌ Video metadata JSON not found.");

    let sources = [];
    try {
      const json = JSON.parse(jsonMatch[1]);
      const media = json?.videoModel?.sources?.mp4;
      if (media) sources = Object.values(media).map(v => v.url);
    } catch (e) {
      console.error("JSON parse error:", e);
    }

    if (sources.length === 0) return reply("❌ Direct video links not found.");

    // Pick best quality (last one = highest)
    const videoUrl = sources[sources.length - 1];

    // Size check
    let fileSize = 0;
    try {
      const head = await axios.head(videoUrl, { timeout: 15000 });
      fileSize = parseInt(head.headers["content-length"] || "0");
    } catch {}

    const safeTitle = title.replace(/[^a-zA-Z0-9 ]/g, "_").slice(0, 64);
    const fileName = `${safeTitle}.mp4`;
    const caption = `🔞 *${title}*`;

    if (fileSize && fileSize > MAX_WHATSAPP_SIZE) {
      return reply(`⚠️ File too large (${(fileSize / 1024 / 1024).toFixed(2)} MB).\nDownload manually:\n${videoUrl}`);
    }

    const sendObj = {
      document: { url: videoUrl },
      mimetype: "video/mp4",
      fileName,
      caption
    };

    if (thumb) {
      try {
        const tRes = await axios.get(thumb, { responseType: "arraybuffer" });
        const jpegThumb = await sharp(Buffer.from(tRes.data)).jpeg().toBuffer();
        sendObj.jpegThumbnail = jpegThumb;
      } catch {}
    }

    await conn.sendMessage(mek.chat, sendObj, { quoted: mek });

  } catch (err) {
    console.error("xviddl error:", err);
    reply("❌ Video download error. Link එක හරියට check කරන්න.");
  }
});
