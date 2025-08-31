const axios = require("axios");
const { cmd } = require('../command');
const { fetchJson } = require('../lib/functions');

const api = `https://nethu-api-ashy.vercel.app`;

let fbCache = {}; // Store temporary video info

// Step 1: User sends FB link
cmd({
  pattern: "facebook",
  react: "🎥",
  alias: ["fbb", "fbvideo", "fb"],
  desc: "Download videos from Facebook",
  category: "download",
  use: '.facebook <facebook_url>',
  filename: __filename
}, async (conn, mek, m, { from, prefix, q, reply }) => {
  try {
    if (!q) return reply("🚩 Please provide a Facebook URL");

    const fb = await fetchJson(`${api}/download/fbdown?url=${encodeURIComponent(q)}`);
    if (!fb.result || (!fb.result.sd && !fb.result.hd)) {
      return reply("❌ Couldn't find any video.");
    }

    // Save to cache
    fbCache[from] = fb.result;

    // Build stylish message
    let caption = `*🎬 SENAL MD FACEBOOK DL*  

📝 TITLE: 𝙵𝙰𝙲𝙴𝙱𝙾𝙾𝙺 𝚅𝙸𝙳𝙴𝙾  
🔗 URL: ${q}

Reply with:
- *.HDV* → Download HD Video  
- *.SDV* → Download SD Video`;

    // Send thumbnail preview
    if (fb.result.thumb) {
      await conn.sendMessage(from, {
        image: { url: fb.result.thumb },
        caption: caption
      }, { quoted: mek });
    } else {
      await reply(caption);
    }

  } catch (err) {
    console.error(err);
    reply("⚠️ *ERROR FB CMD IN SENAL MD BOT*");
  }
});

// Step 2: User requests SD Video
cmd({
  pattern: "SDV",
  react: "🎥",
  desc: "Download SD Facebook Video",
  category: "download",
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  try {
    if (!fbCache[from] || !fbCache[from].sd) return reply("❌ No SD video found. Send the FB link first.");
    await conn.sendMessage(from, {
      video: { url: fbCache[from].sd },
      mimetype: "video/mp4",
      caption: `*✅ DOWNLOADED AS SD QUALITY*\n\n📥 SENAL MD FB VIDEO DL`
    }, { quoted: mek });
  } catch (err) {
    console.error(err);
    reply("⚠️ ERROR SD VIDEO IN SENAL MD BOT");
  }
});

// Step 3: User requests HD Video
cmd({
  pattern: "HDV",
  react: "🎥",
  desc: "Download HD Facebook Video",
  category: "download",
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  try {
    if (!fbCache[from] || !fbCache[from].hd) return reply("❌ No HD video found. Send the FB link first.");
    await conn.sendMessage(from, {
      video: { url: fbCache[from].hd },
      mimetype: "video/mp4",
      caption: `*✅ DOWNLOADED AS HD QUALITY*\n\n📥 SENAL MD FB VIDEO DL`
    }, { quoted: mek });
  } catch (err) {
    console.error(err);
    reply("⚠️ ERROR HD VIDEO IN SENAL MD BOT");
  }
});
