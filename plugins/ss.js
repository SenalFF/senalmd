const { cmd } = require("../command");
const { subsearch, subdl } = require("@sl-code-lords/si-subdl");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const PAGE_SIZE = 5; // results per page

cmd({
  pattern: "ss",
  react: "🎬",
  desc: "Search Sinhala Subtitles with pagination",
  category: "download",
  use: ".sub <movie name>",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    const query = args.join(" ");
    if (!query) return reply("*⚡ Type Movie Name For Get Subtitle.*\nExample: .sub Avengers");

    const results = await subsearch(query);
    if (!results || results.length === 0) return reply("❌ Subtitle not found on Baiscope!");

    // Pagination helper
    const sendPage = async (page = 0) => {
      const start = page * PAGE_SIZE;
      const pageResults = results.slice(start, start + PAGE_SIZE);

      let sections = [
        {
          title: `🎬 Sinhala Subtitles Results (Page ${page + 1}/${Math.ceil(results.length / PAGE_SIZE)})`,
          rows: pageResults.map((res, i) => ({
            title: `${start + i + 1}. ${res.title}`,
            description: "Tap to download subtitle",
            rowId: `.subdl ${res.link}`
          }))
        }
      ];

      // Add pagination buttons
      if (start + PAGE_SIZE < results.length) {
        sections.push({
          title: "➡️ Next Page",
          rows: [{ title: "Next Page ▶️", rowId: `.subpage ${query} ${page + 1}` }]
        });
      }

      await conn.sendMessage(mek.chat, {
        text: `🎬 *Search Results for:* _${query}_\n\n📌 Select a subtitle from the list below.`,
        footer: "© Powered By Senal MD 💠",
        title: "📝 Sinhala Subtitles Finder",
        buttonText: "📂 View Subtitles",
        sections
      }, { quoted: mek });
    };

    // Initial page
    await sendPage(0);

    // Command to handle page clicks
    cmd({
      pattern: "sp",
      fromMe: true,
      dontAddCommandList: true,
      filename: __filename
    }, async (conn2, mek2, m2, { args: pageArgs }) => {
      const query2 = pageArgs.slice(0, -1).join(" ");
      const pageNum = parseInt(pageArgs[pageArgs.length - 1]);
      await sendPage(pageNum);
    });

  } catch (e) {
    console.error(e);
    reply("❌ Error occurred while searching subtitles.");
  }
});

cmd({
  pattern: "sdl",
  react: "⬇️",
  desc: "Download Sinhala Subtitles (Baiscope)",
  category: "download",
  use: ".subdl <subtitle link>",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    const url = args[0];
    if (!url) return reply("*⚡ Please paste subtitle link above.*\nExample: .subdl https://www.baiscopelk.com/...");

    const data = await subdl(url);
    if (!data || !data.download) return reply("❌ Download link not found!");

    let caption = `🎬 *${data.title}*\n\n> *© Powered By Senal MD 💠*`;

    let dlLink = data.download;
    let ext = path.extname(dlLink).toLowerCase() || ".zip";
    let filename = `${data.title || "subtitle"}${ext}`;
    let filePath = path.join(__dirname, "../tmp", filename);

    const response = await axios.get(dlLink, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, response.data);

    // Always send as document
    await conn.sendMessage(mek.chat, {
      document: fs.readFileSync(filePath),
      mimetype: "application/zip",
      fileName: filename,
      caption
    }, { quoted: mek });

    fs.unlinkSync(filePath);

  } catch (e) {
    console.error(e);
    reply("❌ Error occurred while downloading subtitle.");
  }
});
