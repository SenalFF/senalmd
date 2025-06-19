//===========VIDEO-DL===========

const yts = require("yt-search");
const { ytmp4 } = require("@vreden/youtube_scraper");
const { cmd } = require("../command"); // adjust if needed

cmd({
  pattern: "video",
  desc: "Download video",
  category: "download",
  react: "🎥",
  filename: __filename,
},
async (conn, mek, m, {
  from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply
}) => {
  try {
    if (!q) return reply("*කරුණාකර Link එකක් හෝ නමක් ලබා දෙන්න 🔎...*");

    const normalizedQuery = q.startsWith('http') ? q : q;

    const search = await yts(normalizedQuery);
    const data = search.videos[0];
    const url = data.url;

    if (!url) return reply("*🚫 සොයාගත නොහැක!*");

    let des = `╭━❮◆ SENAL MD VIDEO DOWNLOADER ◆❯━╮
┃➤✰ 𝚃𝙸𝚃𝙻𝙴 : ${data.title}
┃➤✰ 𝚅𝙸𝙴𝚆𝚂 : ${data.views}
┃➤✰ 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽 : ${data.description}
┃➤✰ 𝚃𝙸𝙼𝙴 : ${data.timestamp}
┃➤✰ 𝙰𝙶𝙾 : ${data.ago}
╰━━━━━━━━━━━━━━━⪼

> ©ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝚂𝙴𝙽𝙰𝙻`;

    await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: des }, { quoted: mek });

    await reply("*_Downloading_*   ⬇️");

    const down = await ytmp4(url); // using @vreden/youtube_scraper
    const downloadUrl = down.download.url;

    await conn.sendMessage(from, { video: { url: downloadUrl }, mimetype: "video/mp4" }, { quoted: mek });

    await conn.sendMessage(from, {
      document: { url: downloadUrl },
      mimetype: "video/mp4",
      fileName: `${data.title}.mp4`,
      caption: "©ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝚂𝙴𝙽𝙰𝙻 𝙼𝙳"
    }, { quoted: mek });

    await reply("*_UPLOADED_*  ✅");

  } catch (a) {
    reply(`🚫 *දෝෂයක් ඇති විය:*\n${a}`);
  }
});
