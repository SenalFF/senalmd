const { cmd } = require("../command");
const { xvideosdl, xvideosSearch } = require("../lib/scraper");

cmd(
  {
    pattern: "mydl",
    desc: "🔞 Download/Search 18+ videos",
    category: "nsfw",
  },
  async (conn, mek, m, { args, text }) => {
    try {
      if (!text) {
        return conn.sendMessage(m.chat, { text: "📌 *Give me a video URL or search keyword!*" }, { quoted: mek });
      }

      // Check if it's a link or search keyword
      const isURL = /xvideos\.com\/\d+/.test(text);

      if (isURL) {
        // Direct download
        const data = await xvideosdl(text);
        if (!data || !data.result?.url) {
          return conn.sendMessage(m.chat, { text: "❌ *Couldn't fetch video. Try another link.*" }, { quoted: mek });
        }

        const buttons = [
          { buttonId: `mydl_download video ${data.result.url}`, buttonText: { displayText: "📹 Send as Video" }, type: 1 },
          { buttonId: `mydl_download doc ${data.result.url}`, buttonText: { displayText: "📁 Send as Document" }, type: 1 },
        ];

        await conn.sendMessage(
          m.chat,
          {
            text: `🎬 *Xvideos Video Found!*\n\n📌 *Title:* ${data.result.title}\n\nChoose format to download:`,
            buttons,
            headerType: 4,
          },
          { quoted: mek }
        );

      } else {
        // Search mode
        const results = await xvideosSearch(text);
        if (!results || results.length === 0) {
          return conn.sendMessage(m.chat, { text: "❌ *No results found.*" }, { quoted: mek });
        }

        // Show first 5 results with buttons
        const top5 = results.slice(0, 5);
        const buttons = top5.map((vid, i) => ({
          buttonId: `mydl ${vid.url}`,
          buttonText: { displayText: `🎬 ${vid.title.slice(0, 20)}...` },
          type: 1,
        }));

        await conn.sendMessage(
          m.chat,
          {
            text: `🔎 *Search Results for:* ${text}\n\n👉 Select a video below to download`,
            buttons,
            headerType: 1,
          },
          { quoted: mek }
        );
      }

    } catch (e) {
      console.error(e);
      return conn.sendMessage(m.chat, { text: "⚠️ *Error. Try again later.*" }, { quoted: mek });
    }
  }
);

// Button response handler
cmd(
  {
    pattern: "mydl_download",
    dontAddCommandList: true,
  },
  async (conn, mek, m, { args }) => {
    try {
      const type = args[0];
      const dlUrl = args[1];
      if (!dlUrl) return;

      if (type === "doc") {
        await conn.sendMessage(
          m.chat,
          { document: { url: dlUrl }, mimetype: "video/mp4", fileName: "xvideos.mp4", caption: "✅ Here is your video (Document)" },
          { quoted: mek }
        );
      } else {
        await conn.sendMessage(
          m.chat,
          { video: { url: dlUrl }, mimetype: "video/mp4", caption: "✅ Here is your video" },
          { quoted: mek }
        );
      }

    } catch (e) {
      console.error(e);
      conn.sendMessage(m.chat, { text: "⚠️ *Error sending video.*" }, { quoted: mek });
    }
  }
);
