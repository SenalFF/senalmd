const { cmd } = require("../command");
const { fbdown } = require("btch-downloader");

cmd(
  {
    pattern: "fbdl",
    desc: "Download Facebook videos",
    category: "downloader",
  },
  async (conn, mek, m, { args }) => {
    try {
      if (!args[0]) {
        return conn.sendMessage(m.chat, { text: "📌 *Give me a Facebook video URL!*" }, { quoted: mek });
      }

      const url = args[0];
      const data = await fbdown(url);

      if (!data || !data.sd || !data.hd) {
        return conn.sendMessage(m.chat, { text: "❌ *Couldn't fetch video. Try another link.*" }, { quoted: mek });
      }

      // Make buttons for HD / SD / Audio
      const buttons = [
        { buttonId: `fb_download ${data.hd}`, buttonText: { displayText: "📺 Download HD" }, type: 1 },
        { buttonId: `fb_download ${data.sd}`, buttonText: { displayText: "📺 Download SD" }, type: 1 },
        ...(data.audio ? [{ buttonId: `fb_download ${data.audio}`, buttonText: { displayText: "🎵 Download Audio" }, type: 1 }] : [])
      ];

      await conn.sendMessage(
        m.chat,
        {
          text: `🎬 *Facebook Video Found!*\n\n🔗 ${url}\n\nChoose quality to download:`,
          buttons,
          headerType: 4,
        },
        { quoted: mek }
      );

    } catch (e) {
      console.error(e);
      return conn.sendMessage(m.chat, { text: "❌ *Couldn't fetch video. Try another link.*" }, { quoted: mek });
    }
  }
);

// Button response handler
cmd(
  {
    pattern: "fb_download",
    dontAddCommandList: true,
  },
  async (conn, mek, m, { args }) => {
    try {
      const dlUrl = args[0];
      if (!dlUrl) return;

      await conn.sendMessage(
        m.chat,
        { video: { url: dlUrl }, mimetype: "video/mp4", caption: "✅ Here is your video" },
        { quoted: mek }
      );

    } catch (e) {
      console.error(e);
      conn.sendMessage(m.chat, { text: "⚠️ *Error sending video.*" }, { quoted: mek });
    }
  }
);
