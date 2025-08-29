const axios = require("axios");
const cheerio = require("cheerio");
const { cmd } = require("../command");

const MAX_WHATSAPP_SIZE = 2000 * 1024 * 1024; // 2GB doc support

// Helper: fetch HTML
async function fetchHTML(url) {
  const res = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36",
    },
    timeout: 20000,
  });
  return res.data;
}

// ─── SEARCH COMMAND ───
cmd(
  {
    pattern: "xvid",
    react: "🔞",
    desc: "Search xHamster videos",
    category: "adult",
    use: ".xvid <query>",
    filename: __filename,
  },
  async (conn, mek, m, { args, reply }) => {
    try {
      const query = args.join(" ").trim();
      if (!query)
        return reply("⚡ Query එකක් දෙන්න.\nඋදා: *.xvid indian milf*");

      await reply("🔎 Searching xHamster...");

      const searchUrl = `https://xhamster.com/search/${encodeURIComponent(
        query
      )}`;
      const html = await fetchHTML(searchUrl);
      const $ = cheerio.load(html);

      const results = [];
      $("a").each((i, el) => {
        const href = $(el).attr("href");
        const title =
          $(el).attr("title") || $(el).text().trim() || "Untitled";
        const img =
          $(el).find("img").attr("src") ||
          $(el).find("img").attr("data-src") ||
          $(el).attr("data-thumb_url");

        if (!href) return;
        if (/\/videos?\//i.test(href)) {
          const link = href.startsWith("http")
            ? href
            : `https://xhamster.com${href}`;
          results.push({ url: link, title, thumb: img });
        }
      });

      const arr = results.slice(0, 5); // limit to 5 results
      if (arr.length === 0)
        return reply("❌ Search results හමු නොවුණා.");

      for (const r of arr) {
        await conn.sendMessage(
          mek.chat,
          {
            image: r.thumb ? { url: r.thumb } : undefined,
            caption: `*${r.title}*\n🔗 ${r.url}`,
            buttons: [
              {
                buttonId: `.xviddl ${r.url}`,
                buttonText: { displayText: "⬇️ Download as Document" },
                type: 1,
              },
            ],
            headerType: 4,
          },
          { quoted: mek }
        );
      }
    } catch (err) {
      console.error("xvid search error:", err);
      reply("❌ Search එකේ දෝෂයක්. ටිකක් පසුව නැවත උත්සහ කරන්න.");
    }
  }
);

// ─── DOWNLOAD COMMAND ───
cmd(
  {
    pattern: "xviddl",
    react: "⬇️",
    desc: "Download xHamster video as Document",
    category: "adult",
    use: ".xviddl <link>",
    filename: __filename,
  },
  async (conn, mek, m, { args, reply }) => {
    try {
      let url = args[0];
      if (!url)
        return reply(
          "⚡ Link එකක් දෙන්න.\nඋදා: *.xviddl https://xhamster.com/videos/slug-123456*"
        );

      if (!url.startsWith("http")) url = `https://${url}`;

      await reply("⏳ Fetching video page...");

      const html = await fetchHTML(url);

      // Title + Thumbnail
      let title =
        (html.match(
          /<meta property="og:title" content="([^"]+)"/i
        ) || [])[1] || "xhamster_video";
      let thumb = (html.match(
        /<meta property="og:image" content="([^"]+)"/i
      ) || [])[1];

      // Extract MP4 links
      const mp4Regex = /https?:\/\/[^"'()\s]+\.mp4[^"'()\s]*/gi;
      const found = [];
      let match;
      while ((match = mp4Regex.exec(html)) !== null) found.push(match[0]);

      if (found.length === 0) {
        const cfgRegex = /"videoUrl"\s*:\s*"([^"]+\.mp4[^"]*)"/i;
        const cfg = html.match(cfgRegex);
        if (cfg && cfg[1])
          found.push(
            cfg[1].replace(/\\u0026/g, "&").replace(/\\/g, "")
          );
      }

      const unique = Array.from(new Set(found));
      if (unique.length === 0)
        return reply(
          "❌ Direct MP4 link හමු නොවුණා. Manual open කරන්න: " + url
        );

      const videoUrl = unique[0];
      const safeTitle = title.replace(/[^a-zA-Z0-9 ]/g, "_").slice(0, 64);
      const fileName = `${safeTitle}.mp4`;
      const caption = `🔞 *${title}*`;

      // ✅ Always send as Document (up to 2GB)
      await conn.sendMessage(
        mek.chat,
        {
          document: { url: videoUrl },
          mimetype: "video/mp4",
          fileName: fileName,
          caption: caption,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("xviddl error:", err);
      reply(
        "❌ Video download/process එකේ දෝෂයක්. Link එක හරියෙන් තියෙනවද බලන්න."
      );
    }
  }
);
