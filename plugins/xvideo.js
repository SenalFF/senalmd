const { cmd } = require("../command");
const xv = require("xvideos-scraper");

cmd(
  {
    pattern: "mydl",
    desc: "🔞 Search & Download XVideos",
    category: "nsfw",
  },
  async (conn, mek, m, { args, text }) => {
    try {
      if (!text) {
        return conn.sendMessage(m.chat, { text: "📌 Usage: .mydl <keyword or link>" }, { quoted: mek });
      }

      // check if input is a link
      const isUrl = /xvideos\.com\/\d+/.test(text);

      if (isUrl) {
        // direct download
        const data = await xv.getVideoData({ videoUrl: text });
        if (!data || !data.files) {
          return conn.sendMessage(m.chat, { text: "❌ Couldn't fetch video." }, { quoted: mek });
        }

        const buttons = [
          { buttonId: `mydl_download video ${data.files.high}`, buttonText: { displayText: "📹 Download HD" }, type: 1 },
          { buttonId: `mydl_download video ${data.files.low}`, buttonText: { displayText: "📺 Download SD" }, type: 1 },
        ];

        await conn.sendMessage(
          m.chat,
          {
            text: `🎬 *XVideos Video Found!*\n\n📌 *Title:* ${data.title}\n\nChoose quality:`,
            buttons,
            headerType: 4,
          },
          { quoted: mek }
        );

      } else {
        // search mode
        const results = await xv.searchVideo({ search: text, sort: "relevance", pagination: 1 });
        if (!results || results.length === 0) {
          return conn.sendMessage(m.chat, { text: "❌ No results found." }, { quoted: mek });
        }

        // Show first 5 results with buttons
        const top5 = results.slice(0, 5);
        const buttons = top5.map((vid, i) => ({
          buttonId: `mydl ${vid.video}`,
          buttonText: { displayText: `🎬 ${vid.title.slice(0, 25)}...` },
          type: 1,
        }));

        await conn.sendMessage(
          m.chat,
          {
            text: `🔎 *Search Results for:* ${text}\n\n👉 Select a video to download`,
            buttons,
            headerType: 1,
          },
          { quoted: mek }
        );
      }
    } catch (err) {
      console.error(err);
      conn.sendMessage(m.chat, { text: "⚠️ Error fetching video." }, { quoted: mek });
    }
  }
);

// button handler
cmd(
  {
    pattern: "mydl_download",
    dontAddCommandList: true,
  },
  async (conn, mek, m, { args }) => {
    try {
      const dlUrl = args[1];
      if (!dlUrl) return;

      await conn.sendMessage(
        m.chat,
        { video: { url: dlUrl }, mimetype: "video/mp4", caption: "✅ Here is your video" },
        { quoted: mek }
      );
    } catch (err) {
      console.error(err);
      conn.sendMessage(m.chat, { text: "⚠️ Failed to send video." }, { quoted: mek });
    }
  }
);
