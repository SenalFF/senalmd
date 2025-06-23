const { cmd } = require("../command");
const { ttdl } = require("ruhend-scraper");

// ✅ Normalize TikTok URL
function normalizeTikTokUrl(text) {
  const regex = /(https?:\/\/)?(www\.)?(vm\.tiktok\.com|vt\.tiktok\.com|tiktok\.com)\/[^\s]+/;
  const match = text.match(regex);
  return match ? match[0] : null;
}

cmd(
  {
    pattern: "tiktok",
    desc: "Download TikTok videos",
    react: "🎵",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { q, reply, from }) => {
    try {
      if (!q) return reply("*TikTok නමක් හෝ ලින්ක් එකක් ලබාදෙන්න* 🎵");

      const url = normalizeTikTokUrl(q);
      if (!url) return reply("❌ *වලංගු TikTok ලින්ක් එකක් දාන්න!*");

      const data = await ttdl(url);

      if (!data || !data.video) return reply("❌ Video not found or failed to fetch.");

      const {
        title,
        author,
        username,
        published,
        like,
        comment,
        share,
        views,
        bookmark,
        video,
        cover,
      } = data;

      const caption = `
*🎵 TikTok Downloader 🎵*

👤 *User*     : ${author} (@${username})
📝 *Title*    : ${title}
📅 *Date*     : ${published}
👍 *Likes*    : ${like}
💬 *Comments* : ${comment}
🔁 *Shares*   : ${share}
👀 *Views*    : ${views}
🔖 *Bookmarks*: ${bookmark}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇
`.trim();

      // Thumbnail
      await robin.sendMessage(
        from,
        { image: { url: cover }, caption },
        { quoted: mek }
      );

      // Send video
      await robin.sendMessage(
        from,
        {
          video: { url: video },
          mimetype: "video/mp4",
          caption: `🎬 ${title}`,
        },
        { quoted: mek }
      );

      // Optional: Send as document
      await robin.sendMessage(
        from,
        {
          document: { url: video },
          mimetype: "video/mp4",
          fileName: `${title}.mp4`,
          caption: "📁 TikTok Video by MR SENAL",
        },
        { quoted: mek }
      );

      return reply("*✅ TikTok video sent successfully!* 💯");
    } catch (e) {
      console.error("❌ TikTok Error:", e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
