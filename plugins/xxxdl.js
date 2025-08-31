const axios = require("axios");
const cheerio = require("cheerio");
const sharp = require("sharp");
const { cmd } = require("../command");

const MAX_WHATSAPP_SIZE = 64 * 1024 * 1024; // 64 MB

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
  pattern: "xnxx",
  react: "🔞",
  desc: "Search xnxx.tv videos by query",
  category: "adult",
  use: ".xnxx <query>",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    const query = args.join(" ").trim();
    if (!query) return reply("⚡ Query එකක් දෙන්න.\nඋදා: *.xnxx hot milf*");

    await reply("🔎 Searching xnxx.tv...");

    const searchUrl = `https://www.xnxx.tv/search/${encodeURIComponent(query)}`;
    const html = await fetchHTML(searchUrl);
    const $ = cheerio.load(html);

    const videos = [];

    // 🔑 Updated selector for 2025 site
    $("div.thumb a").each((i, el) => {
      const href = $(el).attr("href");
      const title = $(el).attr("title") || $(el).text().trim();
      const thumb = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");

      if (!href || !href.startsWith("/video/")) return;
      const full = href.startsWith("http") ? href : `https://www.xnxx.tv${href}`;
      videos.push({ url: full, title, thumb });
    });

    if (videos.length === 0) return reply("❌ Search results හමු නොවුණා.");

    const limit = Math.min(5, videos.length);
    for (let i = 0; i < limit; i++) {
      const vid = videos[i];
      const caption = `*${i + 1}.* ${vid.title}\n🔗 ${vid.url}\n➡️ Use: *.xnxxdl ${vid.url}*`;

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
          console.error("Thumbnail error:", e);
        }
      }

      await reply(caption);
    }

    if (videos.length > 5) await reply("ℹ️ More results available. Refine your search.");
  } catch (err) {
    console.error("xnxx search error:", err);
    reply("❌ Search error. Try again later.");
  }
});

// ==================== ⬇️ DOWNLOAD COMMAND ====================
cmd({
  pattern: "xnxxdl",
  react: "⬇️",
  desc: "Download xnxx.tv video by URL",
  category: "adult",
  use: ".xnxxdl <video link>",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    let url = args[0];
    if (!url) return reply("⚡ Link එකක් දෙන්න.\nඋදා: *.xnxxdl https://www.xnxx.tv/video/...*");
    if (!url.startsWith("http")) url = `https://${url}`;

    await reply("⏳ Fetching video page...");

    const html = await fetchHTML(url);

    // Title + thumbnail
    let title = (html.match(/<title>(.*?)<\/title>/i) || [])[1] || "xnxx_video";
    let thumb = (html.match(/<meta property="og:image" content="([^"]+)"/i) || [])[1];

    // Extract player JSON (works with current xnxx.tv)
    const playerJsonMatch = html.match(/var\s+player_quality\s*=\s*(\{.*?\});/s);
    if (!playerJsonMatch) return reply("❌ Video JSON not found.");

    let sources = [];
    try {
      const json = JSON.parse(playerJsonMatch[1]);
      if (json && json.html5 && json.html5.mp4) {
        sources = Object.values(json.html5.mp4).map(v => v.url);
      }
    } catch (e) {
      console.error("JSON parse error:", e);
    }

    if (sources.length === 0) return reply("❌ Direct video links not found.");

    const videoUrl = sources[sources.length - 1]; // best quality

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
    console.error("xnxxdl error:", err);
    reply("❌ Video download error. Check the link.");
  }
});
