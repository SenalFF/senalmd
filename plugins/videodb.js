const { cmd } = require("../command"); 
const yts = require("yt-search"); 
const { ytmp4 } = require("@kelvdra/scraper"); 
const axios = require("axios"); 
const { fileTypeFromBuffer } = require("file-type"); 
const uploadToGofile = require("../lib/upload");


const sessions = {}; const MAX_SIZE = 100 * 1024 * 1024;

async function downloadFile(url) { const res = await axios.get(url, { responseType: "arraybuffer" }); return Buffer.from(res.data); }

async function sendOriginal(robin, from, mek, file, title, mimeType = "application/octet-stream") { const isBuffer = Buffer.isBuffer(file); const extension = mimeType.split("/")[1] || "bin"; const fileName = ${title.slice(0, 30)}.${extension};

await robin.sendMessage( from, { document: isBuffer ? file : { url: file }, mimetype: mimeType, fileName, caption: "✅ File sent as original format", }, { quoted: mek } ); }

cmd( { pattern: "vid", desc: "📥 YouTube Video Downloader", category: "download", react: "📹", }, async (robin, mek, m, { q, reply }) => { const from = mek.key.remoteJid; if (!q) return reply("🔍 කරුණාකර වීඩියෝ නමක් හෝ YouTube ලින්ක් එකක් ලබාදෙන්න");

try {
  const searchResult = await yts(q);
  const video = searchResult.videos[0];
  if (!video) return reply("❌ *Video not found.*");

  sessions[from] = { video, step: "await_confirm" };

  const info = `

🎬 SENAL MD Video Downloader

🎞️ Title: ${video.title} ⏱️ Duration: ${video.timestamp} 👁️ Views: ${video.views.toLocaleString()} 📤 Uploaded: ${video.ago} 🔗 URL: ${video.url}

✍️ Reply with get to download this video. `;

await robin.sendMessage(from, { image: { url: video.thumbnail }, caption: info }, { quoted: mek });
} catch (err) {
  console.error("❌ Search Error:", err);
  reply("❌ *Error while searching. Check terminal.*");
}

} );

cmd( { pattern: "get", desc: "📤 Confirm and send video", dontAddCommandList: true, }, async (robin, mek, m, { reply }) => { const from = mek.key.remoteJid; const session = sessions[from]; if (!session || session.step !== "await_confirm") return;

session.step = "downloading";

try {
  await reply("⏬ *Fetching download link...*");
  console.log("📡 Getting download link...");

  const result = await ytmp4(session.video.url, "360");
  if (!result?.download?.url) {
    console.error("❌ No download URL");
    return reply("❌ *Download link not found.*");
  }

  const buffer = await downloadFile(result.download.url);
  const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`📁 File size: ${fileSizeMB} MB`);

  await reply(`📦 *File size:* ${fileSizeMB} MB`);

  if (buffer.length > MAX_SIZE) {
    await reply("☁️ *Uploading to Gofile...*");
    console.log("🚀 Uploading to Gofile...");

    const upload = await uploadToGofile(buffer, `${session.video.title.slice(0, 30)}.mp4`);

    if (!upload.success) {
      await reply("❌ *Upload failed. Check terminal.*");
      console.error("❌ Gofile upload error:", upload.error);
      return;
    }

    await reply("📤 *Streaming from Gofile to WhatsApp...*");
    await sendOriginal(robin, from, mek, upload.directUrl, session.video.title, "video/mp4");
    await reply("✅ *Video sent successfully from Gofile* ✅");

  } else {
    const type = await fileTypeFromBuffer(buffer);
    const mime = type?.mime || "application/octet-stream";

    console.log("📤 Sending file under 100MB to WhatsApp...");
    await sendOriginal(robin, from, mek, buffer, session.video.title, mime);
    await reply("✅ *Video sent directly (under 100MB)* ✅");
  }

} catch (err) {
  console.error("❌ Processing error:", err);
  await reply("❌ *Something went wrong. See terminal for details.*");
}

delete sessions[from];

} );

