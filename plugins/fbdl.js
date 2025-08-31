const axios = require("axios");
const cheerio = require('cheerio');
const { cmd, commands } = require('../command');
const { fetchJson } = require('../lib/functions');

const api = `https://nethu-api-ashy.vercel.app`;

cmd({
  pattern: "fbdl",
  react: "🎥",
  alias: ["fbb", "fbvideo", "fb"],
  desc: "Download videos from Facebook",
  category: "download",
  use: '.facebook <facebook_url>',
  filename: __filename
},
async (conn, mek, m, { from, prefix, q, reply }) => {
  try {
    if (!q) return reply("🚩 Please provide a Facebook URL");

    const fb = await fetchJson(`${api}/download/fbdown?url=${encodeURIComponent(q)}`);
    
    if (!fb.result || (!fb.result.sd && !fb.result.hd)) {
      return reply("❌ Couldn't find any downloadable video!");
    }

    let caption = `┏━━━━━━━━━━━━━━━┓
┃      🎬  ＳＥＮＡＬ ＭＤ  🎬
┃
┃ 📝 ＴＩＴＬＥ : 𝙵𝙰𝙲𝙴𝙱𝙾𝙾𝙺 𝚅𝙸𝙳𝙴𝙾
┃ 🔗 ＵＲＬ : ${q}
┗━━━━━━━━━━━━━━━┛`;

    // Send thumbnail first (if exists)
    if (fb.result.thumb) {
      await conn.sendMessage(from, {
        image: { url: fb.result.thumb },
        caption: caption,
      }, { quoted: mek });
    }

    // Send SD video
    if (fb.result.sd) {
      await conn.sendMessage(from, {
        video: { url: fb.result.sd },
        mimetype: "video/mp4",
        caption: `✅ Downloaded as SD Quality\n\n📥 ＳＥＮＡＬ ＭＤ Facebook Video Downloader`
      }, { quoted: mek });
    }

    // Send HD video
    if (fb.result.hd) {
      await conn.sendMessage(from, {
        video: { url: fb.result.hd },
        mimetype: "video/mp4",
        caption: `✅ Downloaded as HD Quality\n\n📥 ＳＥＮＡＬ ＭＤ Facebook Video Downloader`
      }, { quoted: mek });
    }

  } catch (err) {
    console.error(err);
    reply("> ❌ Error occurred while executing the Facebook download command in ＳＥＮＡＬ ＭＤ");
  }
});
