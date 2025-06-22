const { cmd } = require("../command");
const { ttdl } = require("ruhend-scraper");
const yts = require("yt-search");
const axios = require("axios");

function normalizeTikTokUrl(text) {
  const regex = /(https?:\/\/)?(www\.)?(vm\.tiktok\.com|vt\.tiktok\.com|tiktok\.com)\/[^\s]+/;
  const match = text.match(regex);
  return match ? match[0] : null;
}

async function getFileSizeMB(url) {
  try {
    const res = await axios.head(url);
    return parseInt(res.headers["content-length"] || "0", 10) / (1024 * 1024);
  } catch {
    return 0;
  }
}

cmd(
  {
    pattern: "ttdl",
    desc: "TikTok Downloader with Options",
    react: "🎵",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { q, reply, from }) => {
    try {
      if (!q) return reply("📌 Send TikTok link or video keyword.");

      const url = normalizeTikTokUrl(q);
      let data;

      if (url) {
        data = await ttdl(url);
      } else {
        const search = await yts(q);
        const ytResult = search.videos.find(v => v.author.name.toLowerCase().includes("tiktok") || v.title.toLowerCase().includes("tiktok"));
        if (!ytResult) return reply("❌ TikTok video not found.");
        data = await ttdl(ytResult.url);
      }

      if (!data || !data.video) return reply("❌ Failed to fetch video info.");

      const {
        title,
        author,
        username,
        published,
        like,
        comment,
        share,
        views,
        video,
        music,
        cover,
      } = data;

      const caption = `
🎬 *TikTok Downloader*
👤 *User* : ${author} (@${username})
📝 *Title* : ${title}
📆 *Date* : ${published}
👍 *Likes* : ${like} | 💬 ${comment} | 🔁 ${share} | 👀 ${views}

📥 *What would you like to download?*
1. 🎵 Audio Only
2. 🎥 Full Video
3. ⏱ Short Video (<1min)
4. 📁 Video (Document File)
      
_Reply with 1/2/3/4 to choose option._
`;

      await robin.sendMessage(
        from,
        { image: { url: cover }, caption },
        { quoted: mek }
      );

      // Await reply from user
      robin.ev.once("messages.upsert", async (res) => {
        const userReply = res.messages?.[0]?.message?.conversation || "";
        const option = userReply.trim();

        const fileSize = await getFileSizeMB(video);
        const videoMsg = {
          video: { url: video },
          mimetype: "video/mp4",
          caption: "🎥 TikTok Video",
        };
        const docMsg = {
          document: { url: video },
          mimetype: "video/mp4",
          fileName: `${title}.mp4`,
          caption: "📁 TikTok Video (Document)",
        };
        const audioMsg = {
          audio: { url: music },
          mimetype: "audio/mpeg",
          ptt: false,
        };

        switch (option) {
          case "1":
            await robin.sendMessage(from, audioMsg, { quoted: mek });
            await reply("🎵 *Audio sent successfully!*");
            break;

          case "2":
            await robin.sendMessage(from, videoMsg, { quoted: mek });
            await reply("🎥 *Video sent successfully!*");
            break;

          case "3":
            if (fileSize > 1) return reply("⛔ This video is not short (<1 min).");
            await robin.sendMessage(from, videoMsg, { quoted: mek });
            await reply("⏱ *Short video sent!*");
            break;

          case "4":
            await robin.sendMessage(from, docMsg, { quoted: mek });
            await reply(`📦 *Document uploaded successfully!* (${fileSize.toFixed(2)}MB)`);
            break;

          default:
            await reply("❌ Invalid option. Please reply with 1, 2, 3 or 4.");
        }
      });

    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);
