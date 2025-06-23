const { cmd } = require("../command");
const { ttdl } = require("ruhend-scraper");
const axios = require("axios");

const sessions = new Map();

function extractTikTokUrl(text) {
  const regex = /(https?:\/\/)?(www\.)?(vm\.tiktok\.com|vt\.tiktok\.com|tiktok\.com)\/[^\s]+/;
  const match = text.match(regex);
  return match ? match[0] : null;
}

cmd(
  {
    pattern: "ttdl",
    react: "🎬",
    desc: "TikTok Downloader with Format Options",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { q, from, sender, reply }) => {
    try {
      if (!q) return reply("*TikTok නමක් හෝ ලින්ක් එකක් ලබාදෙන්න* 🎵");

      const url = extractTikTokUrl(q);
      if (!url) return reply("❌ *වලංගු TikTok ලින්ක් එකක් දාන්න!*");

      const data = await ttdl(url);
      if (!data || !data.video) return reply("❌ Couldn't fetch video details!");

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
        music,
        cover,
      } = data;

      // Get file size
      const { data: videoBuffer } = await axios.get(video, { responseType: "arraybuffer" });
      const fileSizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);

      // Save session
      sessions.set(sender, {
        step: "choose_format",
        video,
        music,
        title,
        size: fileSizeMB,
      });

      const caption = `
🎬 *TikTok Video Found*

📝 *Title:* ${title}
👤 *User:* ${author} (@${username})
📅 *Date:* ${published}
👁️ *Views:* ${views}
👍 *Likes:* ${like}
💬 *Comments:* ${comment}
📦 *File Size:* ${fileSizeMB} MB

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇

_➡️ Reply with:_\n1. Audio\n2. Video
      `;

      await robin.sendMessage(
        from,
        { image: { url: cover }, caption },
        { quoted: mek }
      );
    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);

// 🔁 Handle replies
cmd(
  {
    on: "text",
    fromMe: false,
  },
  async (robin, mek, m, { body, sender, reply, from }) => {
    const session = sessions.get(sender);
    if (!session) return;

    const text = body.trim();

    if (session.step === "choose_format") {
      if (text === "1") {
        session.selected = "audio";
        session.step = "choose_type";
        sessions.set(sender, session);
        return reply("*🗂️ Send file type:*\n1. Normal\n2. Document");
      }

      if (text === "2") {
        session.selected = "video";
        session.step = "choose_type";
        sessions.set(sender, session);
        return reply("*🗂️ Send file type:*\n1. Normal\n2. Document");
      }

      return reply("❌ Invalid option. Type 1 or 2.");
    }

    if (session.step === "choose_type") {
      const isNormal = text === "1";
      const isDoc = text === "2";
      const type = session.selected;
      const fileName = `${session.title}.${type === "audio" ? "mp3" : "mp4"}`;

      if (!isNormal && !isDoc) return reply("❌ Invalid choice. Use 1 or 2.");

      await reply(`⬇️ Uploading ${type} as ${isNormal ? "normal file" : "document"}...`);

      try {
        if (type === "audio") {
          if (isNormal) {
            await robin.sendMessage(
              from,
              {
                audio: { url: session.music },
                mimetype: "audio/mp4",
                ptt: false,
                fileName,
              },
              { quoted: mek }
            );
          } else {
            await robin.sendMessage(
              from,
              {
                document: { url: session.music },
                mimetype: "audio/mp4",
                fileName,
              },
              { quoted: mek }
            );
          }
        } else {
          if (isNormal) {
            await robin.sendMessage(
              from,
              {
                video: { url: session.video },
                mimetype: "video/mp4",
                caption: `🎬 ${session.title}`,
              },
              { quoted: mek }
            );
          } else {
            await robin.sendMessage(
              from,
              {
                document: { url: session.video },
                mimetype: "video/mp4",
                fileName,
              },
              { quoted: mek }
            );
          }
        }

        await reply("✅ File uploaded successfully!");
      } catch (err) {
        console.error(err);
        await reply("❌ Upload failed.");
      }

      sessions.delete(sender); // Clear session
    }
  }
);
