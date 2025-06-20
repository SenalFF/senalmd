const { cmd, commands } = require("../command");
const yts = require("yt-search");
const { ytPlaymp4 } = require("ruhend-scraper");

cmd(
  {
    pattern: "video",
    react: "🎵",
    desc: "Download Song",
    category: "download",
    filename: __filename,
  },
  async (
    robin,
    mek,
    m,
    {
      from,
      quoted,
      body,
      isCmd,
      command,
      args,
      q,
      isGroup,
      sender,
      senderNumber,
      botNumber2,
      botNumber,
      pushname,
      isMe,
      isOwner,
      groupMetadata,
      groupName,
      participants,
      groupAdmins,
      isBotAdmins,
      isAdmins,
      reply,
    }
  ) => {
    try {
      if (!q) return reply("*නමක් හරි ලින්ක් එකක් හරි දෙන්න* 🌚❤️");

      // Search for video
      const search = await yts(q);
      const data = search.videos[0];
      const url = data.url;

      // Video metadata
      let desc = `
*❤️SENAL MD Video DOWNLOADER😚*

👻 *title* : ${data.title}
👻 *description* : ${data.description}
👻 *time* : ${data.timestamp}
👻 *ago* : ${data.ago}
👻 *views* : ${data.views}
👻 *url* : ${data.url}

𝐌𝐚𝐝𝐞 𝐛𝐲 𝙈𝙍 𝙎𝙀𝙉𝘼𝙇
`;

      await robin.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      // Video duration limit check (30 min)
      let durationParts = data.timestamp.split(":").map(Number);
      let totalSeconds =
        durationParts.length === 3
          ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
          : durationParts[0] * 60 + durationParts[1];

      if (totalSeconds > 1800) {
        return reply("⏱️ video limit is 30 minitues");
      }

      // Get download link from ruhend-scraper
      const result = await ytPlaymp4(q);

      await robin.sendMessage(
        from,
        {
          video: { url: result.url },
          mimetype: "video/mp4",
        },
        { quoted: mek }
      );

      // Send as document (optional)
      await robin.sendMessage(
        from,
        {
          document: { url: result.url },
          mimetype: "video/mp4",
          fileName: `${result.title}.mp4`,
          caption: "𝐌𝐚𝐝𝐞 𝐛𝐲 𝙎𝙀𝙉𝘼𝙇",
        },
        { quoted: mek }
      );

      return reply("*Thanks for using my bot* 🌚❤️");
    } catch (e) {
      console.log(e);
      reply(`❌ Error: ${e.message}`);
    }
  }
);
