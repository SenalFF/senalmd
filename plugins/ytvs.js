const { cmd } = require("../command");
const { fbdown } = require("btch-downloader");
const axios = require("axios");

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB limit
const sessions = {};

// 🔽 Download file
async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// ▶️ Send inline video
async function sendVideo(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      video: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: `🎬 *${title}*`,
    },
    { quoted: mek }
  );
}

// 📁 Send as document
async function sendDocument(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "✅ *Document sent by SENAL MD* 🎥",
    },
    { quoted: mek }
  );
}

// ▶️ .fbdl command
cmd(
  {
    pattern: "fbdl",
    desc: "📥 Facebook Video Downloader",
    category: "download",
    react: "📹",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;

    if (!q) return reply("🔗 *කරුණාකර Facebook video link එකක් ලබාදෙන්න*");

    try {
      await reply("🔎 Fetching Facebook video info...");

      const data = await fbdown(q);
      if (!data?.hd && !data?.sd) return reply("❌ *Couldn't fetch video. Try another link.*");

      const videoInfo = {
        title: data.title || "Facebook Video",
        url: data.hd || data.sd,
      };

      // Save session
      sessions[from] = { videoInfo, step: "choose_format" };

      const info = `
🎬 *SENAL MD Facebook Downloader*

🎞️ *Title:* ${videoInfo.title}
🔗 *URL:* ${q}

📁 *Choose file type:*
`;

      // Send with reply buttons
      await robin.sendMessage(
        from,
        {
          image: { url: "https://telegra.ph/file/f2be313fe820b56b47748.png" },
          caption: info,
          footer: "SENAL BOT",
          buttons: [
            { buttonId: "fb1", buttonText: { displayText: "📹 Send as Video" }, type: 1 },
            { buttonId: "fb2", buttonText: { displayText: "📁 Send as Document" }, type: 1 },
          ],
          headerType: 4,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("FB Video Error:", err);
      return reply("❌ *Error while fetching Facebook video.*");
    }
  }
);

// 📽️ fb1: send inline video
cmd(
  {
    pattern: "fb1",
    desc: "Send Facebook video inline",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";

    try {
      await reply("⏬ Downloading Facebook video...");
      const buffer = await downloadFile(session.videoInfo.url);
      const filesize = buffer.length;

      if (filesize > MAX_VIDEO_SIZE) {
        await reply(`⚠️ File is ${(filesize / 1024 / 1024).toFixed(2)} MB — sending as document instead.`);
        await sendDocument(robin, from, mek, buffer, session.videoInfo.title);
      } else {
        await reply("📤 Uploading inline video...");
        await sendVideo(robin, from, mek, buffer, session.videoInfo.title);
      }

      await reply("✅ *Video sent successfully!*");
    } catch (err) {
      console.error("FB1 send error:", err);
      await reply("❌ *Failed to send Facebook video.*");
    }

    delete sessions[from];
  }
);

// 📁 fb2: send as document
cmd(
  {
    pattern: "fb2",
    desc: "Send Facebook video as document",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { reply }) => {
    const from = mek.key.remoteJid;
    const session = sessions[from];
    if (!session || session.step !== "choose_format") return;

    session.step = "sending";

    try {
      await reply("⏬ Downloading Facebook video...");
      const buffer = await downloadFile(session.videoInfo.url);

      await reply("📤 Uploading document...");
      await sendDocument(robin, from, mek, buffer, session.videoInfo.title);

      await reply("✅ *Document sent successfully!*");
    } catch (err) {
      console.error("FB2 send error:", err);
      await reply("❌ *Failed to send document.*");
    }

    delete sessions[from];
  }
);
