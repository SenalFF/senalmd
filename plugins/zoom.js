const axios = require("axios");
const { cmd } = require("../command");
const path = require("path");

// ─────────────────────────────
// Search Subtitle Command
// ─────────────────────────────
cmd({
  pattern: "sub",
  react: "🎬",
  desc: "Search Sinhala Subtitles from Zoom.lk",
  category: "download",
  use: ".sub <movie name>",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    const query = args.join(" ");
    if (!query) {
      return reply("*⚡ Type a movie name to get subtitles.*\nExample: `.sub Avengers`");
    }

    const searchUrl = `https://supun-md-api-xmjh.vercel.app/api/zoom-search?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(searchUrl);

    if (!data?.results || data.results.length === 0) {
      return reply("❌ Movie not found on Zoom.lk!");
    }

    let txt = `🎬 *ＫɪɴＧ ＳᴀɴᴅᴇꜱＨ ＭＤ ＺᴏᴏＭ ＳᴜʙᴛɪᴛʟＥ ＤᴏᴡɴʟᴏᴀᴅᴇＲ* 🎬\n\n`;
    data.results.forEach((res, i) => {
      txt += `*${i + 1}.* ${res.title}\n👤 ${res.author}\n💬 Comments: ${res.comments}\n🔗 Link: ${res.link}\n\n`;
    });
    txt += `➡️ Use: \`.subdl <movie link>\` to download subtitle`;

    await reply(txt);

  } catch (e) {
    console.error("Subtitle Search Error:", e.message || e);
    reply("⚠️ Error while searching subtitle. Try again later.");
  }
});

// ─────────────────────────────
// Download Subtitle Command
// ─────────────────────────────
cmd({
  pattern: "subdl",
  react: "⬇️",
  desc: "Download Sinhala Subtitle from Zoom.lk",
  category: "download",
  use: ".subdl <zoom.lk movie link>",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    const url = args[0];
    if (!url) {
      return reply("*⚡ Paste the Zoom.lk subtitle link.*\nExample: `.subdl https://zoom.lk/...`");
    }

    const dlApiUrl = `https://supun-md-api-xmjh.vercel.app/api/zoom-dl?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(dlApiUrl);

    // helper: recursive URL finder
    function findUrlInObj(obj) {
      if (!obj) return null;
      if (typeof obj === "string") {
        return /^https?:\/\//i.test(obj) ? obj : null;
      }
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const found = findUrlInObj(item);
          if (found) return found;
        }
      } else if (typeof obj === "object") {
        for (const k of Object.keys(obj)) {
          const found = findUrlInObj(obj[k]);
          if (found) return found;
        }
      }
      return null;
    }

    let dlLink =
      data?.results?.dl_link ||
      data?.results?.download ||
      data?.dl_link ||
      findUrlInObj(data);

    if (!dlLink) {
      console.log("zoom-dl API response (short):", JSON.stringify(data).slice(0, 2000));
      return reply("❌ Download link not found in API response. Check logs.");
    }

    // Build caption
    const title = (data?.results?.title || data?.title || "subtitle").toString();
    let cap = `🎬 *${title}*\n`;
    if (data?.results?.date) cap += `📅 Date: ${data.results.date}\n`;
    if (data?.results?.view) cap += `👁️ Views: ${data.results.view}\n`;
    if (data?.results?.size) cap += `💾 Size: ${data.results.size}\n`;
    cap += `\n> *© Powered By King-Sandesh Md V2 💸*`;

    // Download subtitle into memory
    const fileResp = await axios.get(dlLink, {
      responseType: "arraybuffer",
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const fileBuffer = Buffer.from(fileResp.data);

    // Detect filename + extension
    const rawPath = dlLink.split("?")[0].split("#")[0];
    let ext = path.extname(rawPath).toLowerCase();

    const contentType = (fileResp.headers && fileResp.headers["content-type"]) || "";
    const mimeExtMap = {
      "application/x-subrip": ".srt",
      "text/plain": ".srt",
      "application/zip": ".zip",
      "application/octet-stream": ".bin",
      "video/mp4": ".mp4",
      "video/x-matroska": ".mkv"
    };
    if (!ext) {
      const ct = contentType.split(";")[0].trim();
      if (mimeExtMap[ct]) ext = mimeExtMap[ct];
    }
    if (!ext) ext = ".zip";

    const safeName = title.replace(/[^\w\.\- ]+/g, "_").substring(0, 120);
    const filename = `${safeName}${ext}`;
    const mimetype = contentType || (ext === ".srt" ? "application/x-subrip" : "application/octet-stream");

    // Send as document (direct buffer)
    await conn.sendMessage(
      mek.chat,
      {
        document: fileBuffer,
        mimetype,
        fileName: filename,
        caption: cap
      },
      { quoted: mek }
    );

  } catch (err) {
    console.error("subdl error:", err?.response?.status, err?.response?.data || err?.message || err);
    reply("❌ Error occurred while fetching or sending download. Check bot logs.");
  }
});
