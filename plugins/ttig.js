const { cmd } = require("../command");
const { tiktokdl, tiktoks } = require("@kelvdra/scraper");
const axios = require("axios");

const MAX_INLINE_SIZE = 16 * 1024 * 1024; // 16 MB
const sessions = {};

// 🔁 Download file to Buffer
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// ▶️ .tt command - Search & ask file type
cmd(
  {
    pattern: "tiktok",
    desc: "📲 TikTok Downloader",
    category: "download",
    react: "🎵",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;

    if (!q) return reply("🔍 *Please enter a TikTok link or search term*");

    let link = q;
    if (!q.includes("tiktok.com")) {
      // Search by keyword
      const results = await tiktoks(q);
      if (!results || !results[0]) return reply("❌ *No TikTok found.*");

      link = results[0].url;
    }

    try {
      const res = await tiktokdl(link);
      if (!res?.video?.url) return reply("❌ *Failed to get download link.*");

      sessions[from] = {
        url: res.video.url,
        thumb: res.thumbnail,
        title: res.description || "TikTok Video",
        step: "choose_format",
      };

      const info = `
🎬 *TIKTOK VIDEO DOWNLOADER*

📝 *Title:* ${res.description || "N/A"}
📺 *Quality:* HD
🎧 *Audio Available:* ${res.audio?.url ? "Yes" : "No"}

📁 *Choose file type to receive:*
1️⃣ Video (Inline)
2️⃣ Document (File)

✍️ _Please reply with 1 or 2_
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
      reply("❌ *Error downloading TikTok video.*");
    }
  }
);

// 1️⃣ Inline video
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

    session.step = "sending";

    try {
      const buffer = await downloadFile(session.url);

      if (buffer.length > MAX_INLINE_SIZE) {
        await reply("⚠️ *Video too large for inline. Sending as document...*");
        await robin.sendMessage(
          from,
          {
            document: buffer,
            mimetype: "video/mp4",
            fileName: `${session.title.slice(0, 30)}.mp4`,
            caption: "🎥 *Sent by SENAL MD*",
          },
          { quoted: mek }
        );
      } else {
        await reply("📤 *Uploading video...*");
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

      await reply("✅ *Video sent successfully!*");
    } catch (e) {
      console.error("Inline send error:", e);
      reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// 2️⃣ Document
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

    session.step = "sending";

    try {
      const buffer = await downloadFile(session.url);

      await reply("📤 *Uploading document...*");
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
      console.error("Doc send error:", e);
      reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
