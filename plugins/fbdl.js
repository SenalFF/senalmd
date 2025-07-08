const { cmd } = require("../command");
const { fbdl } = require("ruhend-scraper");
const axios = require("axios");

const sessions = {};

async function getBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

async function sendFbVideo(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "📄 *Facebook Video sent by SENAL MD*",
    },
    { quoted: mek }
  );
}

// 🔹 Command: .fb <link>
cmd(
  {
    pattern: "fb",
    desc: "📥 Download Facebook video",
    category: "download",
    react: "📘",
    filename: __filename,
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;

    if (!q || !q.includes("facebook.com")) {
      return reply("❌ *Please send a valid Facebook video link.*");
    }

    try {
      await reply("🔍 Getting Facebook video details...");

      const result = await fbdl(q);
      const data = result.data || result;

      if (!data?.url) return reply("❌ Couldn't fetch the video URL.");

      // Pre-fetch to get file size
      const buffer = await getBuffer(data.url);
      const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);

      // Save session
      sessions[from] = {
        step: "waiting_reply",
        buffer,
        title: data.title || "Facebook Video",
      };

      const caption = `
🎬 *Facebook Video Downloader*

📄 *Title:* ${data.title || "N/A"}
📦 *File Size:* ${fileSizeMB} MB
🎞️ *Quality:* ${data.sd ? "SD" : "HD"} (auto-detected)
🔗 *Source:* ${q}

✍️ _Reply with *1* to receive the video as document_
      `.trim();

      await robin.sendMessage(
        from,
        {
          image: { url: data.thumbnail || "https://telegra.ph/file/f2be313fe820b56b47748.png" },
          caption,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("FB Downloader Error:", err);
      return reply("❌ *Error fetching Facebook video. Try again later.*");
    }
  }
);

// 🔹 Handle user reply: 1
cmd(
  {
    pattern: "v1",
    on: "text",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];

    if (!session || session.step !== "waiting_reply") return;

    try {
      await reply("📤 Uploading video as document...");
      await sendFbVideo(robin, from, mek, session.buffer, session.title);
      await reply("✅ *Video sent successfully!*");
    } catch (err) {
      console.error("Send video error:", err);
      await reply("❌ *Failed to send video.*");
    }

    delete sessions[from];
  }
)
