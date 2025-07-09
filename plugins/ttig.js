const { cmd } = require("../command");
const { ttdl, tiktoks } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_INLINE_SIZE = 16 * 1024 * 1024; // 16 MB
const sessions = {};

// 🧲 Download file
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// 🎬 .tt command — TikTok video handler
cmd(
  {
    pattern: "tiktok",
    desc: "📲 TikTok Downloader",
    category: "download",
    react: "🎵",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;

    if (!q) return reply("❗ *Please enter a TikTok link or search keyword*");

    let link = q;
    if (!q.includes("tiktok.com")) {
      const results = await tiktoks(q);
      if (!results || !results[0]?.url) return reply("❌ *No results found.*");
      link = results[0].url;
    }

    try {
      const res = await ttdl(link);
      if (!res?.video?.url) return reply("❌ *Failed to get download URL.*");

      sessions[from] = {
        url: res.video.url,
        title: res.description || "TikTok Video",
        thumb: res.thumbnail,
        step: "choose_format",
      };

      const info = `
🎬 *TikTok Video Downloader*

📝 *Title:* ${res.description || "N/A"}
🎧 *Audio:* ${res.audio?.url ? "Available" : "Not Available"}
📦 *Quality:* HD

📁 *Choose file type to receive:*
1️⃣ Inline Video
2️⃣ Document

✍️ _Reply with 1 or 2_
`;

      await robin.sendMessage(
        from,
        {
          image: { url: res.thumbnail },
          caption: info,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error("TikTok error:", e);
      return reply("❌ *Error downloading TikTok video.*");
    }
  }
);

// 1️⃣ Send as inline
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    try {
      const buffer = await downloadFile(session.url);
      const size = buffer.length;

      if (size > MAX_INLINE_SIZE) {
        await reply(`⚠️ File is ${(size / 1024 / 1024).toFixed(2)}MB. Sending as document...`);
        await robin.sendMessage(
          from,
          {
            document: buffer,
            mimetype: "video/mp4",
            fileName: `${session.title.slice(0, 30)}.mp4`,
            caption: "📄 *Sent by SENAL MD*",
          },
          { quoted: mek }
        );
      } else {
        await reply("📤 Uploading video...");
        await robin.sendMessage(
          from,
          {
            video: buffer,
            mimetype: "video/mp4",
            fileName: `${session.title.slice(0, 30)}.mp4`,
            caption: "🎥 *Sent by SENAL MD*",
          },
          { quoted: mek }
        );
      }

      await reply("✅ *Sent successfully!*");
    } catch (e) {
      console.error("Inline video error:", e);
      return reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// 2️⃣ Send as document
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    try {
      const buffer = await downloadFile(session.url);
      await reply("📤 Uploading as document...");

      await robin.sendMessage(
        from,
        {
          document: buffer,
          mimetype: "video/mp4",
          fileName: `${session.title.slice(0, 30)}.mp4`,
          caption: "📄 *Sent by SENAL MD*",
        },
        { quoted: mek }
      );

      await reply("✅ *Document sent successfully!*");
    } catch (e) {
      console.error("Document send error:", e);
      return reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
