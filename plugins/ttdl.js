// plugins/ttdl.js
const { cmd } = require("../command");
const { ttdl } = require("ruhend-scraper");
const yts = require("yt-search");
const axios = require("axios");

module.exports = function (client) {
  const activeSessions = new Map();

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
      pattern: "tiktok",
      desc: "TikTok Downloader with Options",
      react: "🎵",
      category: "download",
      filename: __filename,
    },
    async (robin, mek, m, { q, reply, from }) => {
      try {
        const sender = mek.key.participant || mek.key.remoteJid;

        if (!q) return reply("📌 Send TikTok link or video keyword.");

        const url = normalizeTikTokUrl(q);
        let data;

        if (url) {
          data = await ttdl(url);
        } else {
          const search = await yts(q);
          const ytResult = search.videos.find(
            (v) =>
              v.author.name.toLowerCase().includes("tiktok") ||
              v.title.toLowerCase().includes("tiktok")
          );
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

        await client.sendMessage(
          from,
          { image: { url: cover }, caption },
          { quoted: mek }
        );

        activeSessions.set(sender, {
          from,
          title,
          video,
          music,
          quoted: mek,
        });

        setTimeout(() => {
          if (activeSessions.has(sender)) {
            activeSessions.delete(sender);
            client.sendMessage(from, { text: "⌛ Timeout. Please try again." }, { quoted: mek });
          }
        }, 60000);
      } catch (e) {
        console.error(e);
        return reply(`❌ Error: ${e.message}`);
      }
    }
  );

  // Handle follow-up user replies
  client.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const sender = msg.key.participant || msg.key.remoteJid;
    const session = activeSessions.get(sender);
    if (!session) return;

    const from = msg.key.remoteJid;
    const userReply =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";

    const option = userReply.trim();

    if (!["1", "2", "3", "4"].includes(option)) {
      await client.sendMessage(from, { text: "❌ Invalid option. Reply with 1, 2, 3 or 4." }, { quoted: msg });
      return;
    }

    activeSessions.delete(sender);

    const { video, music, title, quoted } = session;
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
        await client.sendMessage(from, audioMsg, { quoted: quoted });
        break;
      case "2":
        await client.sendMessage(from, videoMsg, { quoted: quoted });
        break;
      case "3":
        if (fileSize > 1)
          return await client.sendMessage(from, { text: "⛔ This video is not short (<1 min)." }, { quoted: quoted });
        await client.sendMessage(from, videoMsg, { quoted: quoted });
        break;
      case "4":
        await client.sendMessage(from, docMsg, { quoted: quoted });
        break;
    }
  });
};
