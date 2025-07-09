const { cmd } = require("../command");
const axios = require("axios");
const { tiktokdl } = require("@kelvdra/scraper");
const { https } = require("follow-redirects");

const MAX_INLINE_SIZE = 16 * 1024 * 1024; // 16 MB
const sessions = {};

// ✅ Normalize TikTok Link
async function normalizeTikTokLink(input) {
  return new Promise((resolve, reject) => {
    try {
      if (!input.startsWith("http")) input = "https://" + input;

      const req = https.get(input, (res) => {
        resolve(res.responseUrl || input); // Final redirected URL
      });

      req.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// 🔽 Download video buffer
async function downloadBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// 🎥 Inline send
async function sendInline(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      video: buffer,
      mimetype: "video/mp4",
      caption: `🎬 *${title}*`,
    },
    { quoted: mek }
  );
}

// 📄 Send as document
async function sendDoc(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: `📄 *Sent by SENAL MD*`,
    },
    { quoted: mek }
  );
}

// ▶️ Command: .tt
cmd(
  {
    pattern: "tiktok",
    desc: "📥 TikTok Video Downloader",
    category: "download",
    react: "🎵",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    try {
      if (!q || !q.includes("tiktok.com")) {
        return reply("🔗 *Please provide a valid TikTok link.*");
      }

      await reply("🔍 Resolving and fetching TikTok video...");

      const fullUrl = await normalizeTikTokLink(q);

      const res = await tiktokdl(fullUrl);
      if (!res?.status || !res?.result?.video?.url) {
        return reply("❌ *Failed to get download link.*");
      }

      const { desc, author, duration, thumbnail, video } = res.result;
      const title = desc || "TikTok Video";

      const buffer = await downloadBuffer(video.url);
      const filesize = buffer.length;
      const sizeMB = (filesize / 1024 / 1024).toFixed(2);

      sessions[from] = {
        title,
        buffer,
        filesize,
        step: "choose_tiktok",
      };

      const info = `
🎥 *TikTok Video Found*

📝 *Title:* ${title}
👤 *Author:* ${author.nickname} (@${author.unique_id})
⏱️ *Duration:* ${duration}s
📦 *Size:* ${sizeMB} MB

📁 Choose file type:
1️⃣ Inline Video
2️⃣ Document

✍️ _Please reply with 1 or 2_
`;

      await robin.sendMessage(
        from,
        {
          image: { url: thumbnail },
          caption: info,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error("TikTok Download Error:", e);
      return reply("❌ *Error downloading TikTok video.*");
    }
  }
);

// 1️⃣ Inline send
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_tiktok") return;

    try {
      if (session.filesize > MAX_INLINE_SIZE) {
        await reply("⚠️ *Too large for inline. Sending as document...*");
        await sendDoc(robin, from, mek, session.buffer, session.title);
      } else {
        await reply("📤 Uploading...");
        await sendInline(robin, from, mek, session.buffer, session.title);
      }
      await reply("✅ *Video sent!*");
    } catch (err) {
      console.error("Inline Error:", err);
      await reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
);

// 2️⃣ Document send
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_tiktok") return;

    try {
      await reply("📤 Uploading as document...");
      await sendDoc(robin, from, mek, session.buffer, session.title);
      await reply("✅ *Sent successfully!*");
    } catch (err) {
      console.error("Document Error:", err);
      await reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
