const { cmd } = require("../command");
const { ttdl } = require("ruhend-scraper");

const sessions = {};

// 🎬 Step 1: TikTok URL input
cmd(
  {
    pattern: "ttdl",
    desc: "TikTok Video Downloader",
    category: "download",
    react: "🎬",
  },
  async (robin, mek, m, { q, from, reply }) => {
    if (!q) return reply("🔍 *TikTok ලින්ක් එකක් හෝ නමක් දෙන්න...*");

    const regex = /(https?:\/\/)?(www\.)?(vm\.tiktok\.com|vt\.tiktok\.com|tiktok\.com)\/[^\s]+/;
    const match = q.match(regex);
    const url = match ? match[0] : null;

    if (!url) return reply("❌ *වලංගු TikTok ලින්ක් එකක් දාන්න!*");

    try {
      const data = await ttdl(url);
      if (!data || !data.video) return reply("❌ Couldn't fetch video info!");

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

      sessions[from] = {
        title,
        video,
        audio: music,
        cover,
        step: "choose_format",
        type: null,
      };

      await robin.sendMessage(
        from,
        {
          image: { url: cover },
          caption:
            `*🎬 SENAL MD TikTok Downloader*\n\n` +
            `🎵 *Title:* ${title}\n` +
            `👤 *User:* ${author} (@${username})\n` +
            `📅 *Date:* ${published}\n` +
            `👁 *Views:* ${views} | 👍 ${like} | 💬 ${comment}\n\n` +
            `📁 *File Type එක තෝරන්න:*\n1. Audio\n2. Video`,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error(e);
      return reply(`❌ Error: ${e.message}`);
    }
  }
);

// 🥁 Step 2: Choose Audio or Video
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.type = "audio";
    session.step = "choose_send_type";

    return robin.sendMessage(from, {
      text: "*📦 File එක කොහොමද එවන්න?*\n1. Normal\n2. Document",
    }, { quoted: mek });
  }
);

cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from }) => {
    const session = sessions[from];
    if (!session) return;

    if (session.step === "choose_format") {
      session.type = "video";
      session.step = "choose_send_type";

      return robin.sendMessage(from, {
        text: "*📦 File එක කොහොමද එවන්න?*\n1. Normal\n2. Document",
      }, { quoted: mek });
    }

    if (session.step === "choose_send_type") {
      const url = session.type === "audio" ? session.audio : session.video;
      const mimetype = session.type === "audio" ? "audio/mp4" : "video/mp4";
      const extension = session.type === "audio" ? "mp3" : "mp4";

      await robin.sendMessage(from, {
        document: { url },
        mimetype,
        fileName: `${session.title}.${extension}`,
        caption: "✅ 𝐅𝐢𝐥𝐞 𝐬𝐞𝐧𝐭 𝐛𝐲 𝐒𝐄𝐍𝐀𝐋 𝐌𝐃 ❤️",
      }, { quoted: mek });

      delete sessions[from];
    }
  }
);

// ✅ Step 3: Send Normal File (video or audio)
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_send_type") return;

    const url = session.type === "audio" ? session.audio : session.video;
    const mimetype = session.type === "audio" ? "audio/mp4" : "video/mp4";

    await robin.sendMessage(
      from,
      {
        [session.type]: { url }, // ✅ sends as normal video/audio, NOT document
        mimetype,
        caption: `🎧 ${session.title}`,
      },
      { quoted: mek }
    );

    delete sessions[from];
  }
);
