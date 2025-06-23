const { cmd } = require("../command");
const { ttdl } = require("ruhend-scraper");
const axios = require("axios");

const sessions = new Map();

function normalizeTikTokUrl(text) {
  const regex = /(https?:\/\/)?(www\.)?(vm\.tiktok\.com|vt\.tiktok\.com|tiktok\.com)\/[^\s]+/;
  const match = text.match(regex);
  return match ? match[0] : null;
}

cmd(
  {
    pattern: "ttdl",
    desc: "Download TikTok videos",
    react: "🎵",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { q, reply, from, sender }) => {
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
        music,
      } = data;

      const { data: videoBuffer } = await axios.get(video, { responseType: "arraybuffer" });
      const sizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);

      sessions.set(sender, {
        step: "fileType",
        video,
        music,
        title,
        cover,
        size: sizeMB,
      });

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
📦 *File Size*: ${sizeMB} MB

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇
`;

      await robin.sendMessage(
        from,
        { image: { url: cover }, caption },
        { quoted: mek }
      );

      await reply(
        `*Choose File Type:*\n1. 🎵 Audio\n2. 🎥 Video`
      );
    } catch (e) {
      console.error("❌ TikTok Error:", e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);

// Handle replies (interactive flow)
cmd(
  {
    on: "text",
    fromMe: false,
  },
  async (robin, mek, m, { body, sender, reply, from }) => {
    const session = sessions.get(sender);
    if (!session) return;

    const text = body.trim();

    // Step 1: Choose Audio or Video
    if (session.step === "fileType") {
      if (text === "1") {
        // Audio
        await reply("⬇️ Uploading audio... Please wait!");
        try {
          await robin.sendMessage(
            from,
            {
              audio: { url: session.music },
              mimetype: "audio/mp4",
              ptt: false,
              fileName: `${session.title}.mp3`,
            },
            { quoted: mek }
          );
          await reply("✅ Audio uploaded successfully!");
        } catch (err) {
          console.error(err);
          await reply("❌ Failed to upload audio.");
        }
        return sessions.delete(sender);
      }

      if (text === "2") {
        session.step = "format";
        sessions.set(sender, session);
        return reply("*Send Format:*\n1. 📽️ Normal Video\n2. 📁 Document");
      }

      return reply("❌ Invalid choice. Please type 1 or 2.");
    }

    // Step 2: Choose Video Format
    if (session.step === "format") {
      await reply("⬇️ Uploading video... Please wait!");
      try {
        if (text === "1") {
          await robin.sendMessage(
            from,
            {
              video: { url: session.video },
              mimetype: "video/mp4",
              caption: `🎬 ${session.title}`,
            },
            { quoted: mek }
          );
        } else if (text === "2") {
          await robin.sendMessage(
            from,
            {
              document: { url: session.video },
              mimetype: "video/mp4",
              fileName: `${session.title}.mp4`,
              caption: "📁 TikTok video by MR SENAL",
            },
            { quoted: mek }
          );
        } else {
          return reply("❌ Invalid format option. Please send 1 or 2.");
        }

        await reply("✅ Video uploaded successfully!");
        sessions.delete(sender);
      } catch (err) {
        console.error(err);
        sessions.delete(sender);
        return reply("❌ Upload failed.");
      }
    }
  }
);
