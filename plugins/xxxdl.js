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
      $("a.video-thumb").each((i, el) => {
        if (results.length >= 5) return false;
        const link = $(el).attr("href");
        const title =
          $(el).attr("title") || $(el).find("img").attr("alt") || "Untitled";
        const img =
          $(el).find("img").attr("src") || $(el).find("img").attr("data-src");
        if (link && title && img) {
          results.push({
            url: link.startsWith("http")
              ? link
              : `https://xhamster.com${link}`,
            title,
            thumb: img,
          });
        }
      });

      if (results.length === 0)
        return reply("❌ Search results හමු නොවුණා.");

      for (const r of results) {
        await conn.sendMessage(
          mek.chat,
          {
            image: { url: r.thumb },
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

      let title =
        (html.match(
          /<meta property="og:title" content="([^"]+)"/i
        ) || [])[1] || "xhamster_video";
      let thumb = (html.match(
        /<meta property="og:image" content="([^"]+)"/i
      ) || [])[1];

      // find MP4 links
      const mp4Regex = /https?:\/\/[^"'()\s]+\.mp4[^"'()\s]*/gi;
      const found = [];
      let mRes;
      while ((mRes = mp4Regex.exec(html)) !== null) found.push(mRes[0]);

      if (found.length === 0) {
        const cfgRegex =
          /"videoUrl"\s*:\s*"([^"]+\.mp4[^"]*)"/i;
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

      // title safe filename
      const safeTitle = title.replace(/[^a-zA-Z0-9 ]/g, "_").slice(0, 64);
      const fileName = `${safeTitle}.mp4`;
      const caption = `🔞 *${title}*`;

      // ✅ Always send as Document (no inline play, large files supported)
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
