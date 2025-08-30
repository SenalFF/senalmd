const axios = require("axios");
const { cmd } = require("../command");
const path = require("path");

// ─── SEARCH SUBTITLES ──────────────────────────────
cmd({
  pattern: "sub",
  react: "🎬",
  desc: "Search and download Sinhala Subtitles from Zoom.lk",
  category: "download",
  use: ".sub <movie name>",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    const query = args.join(" ");
    if (!query) return reply("*⚡Type Your Movie Name For Get Subtitle.*\nExample: *.sub Avengers*");

    const searchUrl = `https://supun-md-api-xmjh.vercel.app/api/zoom-search?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(searchUrl);

    if (!data.results || data.results.length === 0) {
      return reply("> ❌ Movie Not Found On Zoom..!");
    }

    let txt = `🎬 *ＫɪɴＧ ＳᴀɴᴅᴇꜱＨ ＭＤ ＺᴏᴏＭ ＳᴜʙᴛɪᴛʟＥ ＤᴏᴡɴʟᴏᴀᴅᴇＲ* 🎬\n\n`;
    data.results.forEach((res, i) => {
      txt += `*${i + 1}.* ${res.title}\n👤 ${res.author}\n💬 𝙲𝙾𝙼𝙼𝙴𝙽𝚃𝚂: ${res.comments}\n🔗 𝙻𝙸𝙽𝙺: ${res.link}\n\n`;
    });
    txt += `\n➡️ Use: *.subdl <movie link>* to download`;

    await reply(txt);

  } catch (e) {
    console.log("SEARCH ERROR:", e);
    reply("❌ Error occurred while searching movie.");
  }
});

// ─── DOWNLOAD SUBTITLE ──────────────────────────────
cmd({
  pattern: "subdl",
  react: "⬇️",
  desc: "Download Sinhala Subtitle Movies from Zoom.lk",
  category: "download",
  use: ".subdl <zoom.lk movie link>",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    const url = args[0];
    if (!url) return reply("*⚡Please Copy And Paste Your Zoom Subtitle Link.*\nExample: *.subdl https://zoom.lk/...*");

    const dlUrl = `https://supun-md-api-xmjh.vercel.app/api/zoom-dl?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(dlUrl);

    if (!data.results || !data.results.dl_link) {
      return reply("❌ Download link not found!");
    }

    let dlLink = data.results.dl_link;
    let ext = path.extname(dlLink) || ".zip"; // fallback .zip
    let filename = `${(data.results.title || "subtitle").replace(/[^\w\s]/gi, "_")}${ext}`;

    // Fetch subtitle directly as buffer
    const response = await axios.get(dlLink, { responseType: "arraybuffer" });

    let cap = `🎬 *${data.results.title}*\n\n`;
    cap += `📅 𝙳𝙰𝚃𝙴: ${data.results.date}\n`;
    cap += `👁️ 𝚅𝙸𝙴𝚆𝚂: ${data.results.view}\n`;
    cap += `💾 𝚂𝙸𝚉𝙴: ${data.results.size}\n\n> *© Powered By King-Sandesh Md V2 💸*`;

    // Always send as document
    await conn.sendMessage(mek.chat, {
      document: Buffer.from(response.data),
      mimetype: "application/zip", // safe for .zip/.srt/.txt
      fileName: filename,
      caption: cap
    }, { quoted: mek });

  } catch (e) {
    console.error("SUBDL ERROR:", e);
    reply("❌ Error occurred while fetching or sending download.");
  }
});
