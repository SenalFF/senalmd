const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3, playmp3 } = require("@kelvdra/scraper");

const sessions = {};
const SIZE_LIMIT = 16 * 1024 * 1024; // 16MB

cmd(
  {
    pattern: "song",
    desc: "YouTube Music Downloader (audio + doc)",
    category: "download",
    react: "🎵",
  },
  async (robin, mek, m, { q, from, reply }) => {
    if (!q) return reply("🔍 *YouTube ගීත නමක් හෝ ලින්ක් එකක් දාන්න...*");

    try {
      await robin.sendMessage(from, { text: "⏳ *Searching... Please wait...*" }, { quoted: mek });

      // 1. Search with yt-search
      const searchResult = await yts(q);
      if (!searchResult || !searchResult.videos || !searchResult.videos.length)
        return reply("❌ *No results found for your query.*");

      const video = searchResult.videos[0]; // take first result

      // 2. Get audio download URL + filesize using @kelvdra/scraper download()
      const audioData = await download(video.url, { quality: "highestaudio" });
      if (!audioData || !audioData.url) return reply("❌ *Audio download failed.*");

      // Store session info for user
      sessions[from] = {
        title: video.title,
        url: audioData.url,
        filesize: audioData.filesize || 0,
        duration: video.timestamp,
        step: "choose_send_type",
      };

      // Format bytes helper
      function formatBytes(bytes) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024,
          sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
      }

      // 3. Send song details + filesize
      const detailsMsg =
        `🎵 *Title:* ${video.title}\n` +
        `⏰ *Duration:* ${video.timestamp}\n` +
        `📦 *File Size:* ${formatBytes(sessions[from].filesize)}\n\n` +
        `📩 *Reply with:*\n` +
        `1️⃣ Audio (Play on WhatsApp)\n` +
        `2️⃣ Document (Full audio file)`;

      await robin.sendMessage(from, { text: detailsMsg }, { quoted: mek });
    } catch (e) {
      console.error(e);
      reply("❌ *Error occurred, please try again later.*");
    }
  }
);

// Reply "1" = send audio (check filesize ≤16MB)
cmd(
  {
    pattern: "1",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_send_type") return;

    try {
      if (session.filesize > SIZE_LIMIT) {
        // Send as document + warn
        await robin.sendMessage(
          from,
          {
            document: { url: session.url },
            mimetype: "audio/mpeg",
            fileName: `${session.title}.mp3`,
            caption:
              "⚠️ *This file is too big to preview on WhatsApp.*\nSending as document instead.",
          },
          { quoted: mek }
        );
      } else {
        // Send as audio
        await robin.sendMessage(
          from,
          {
            audio: { url: session.url },
            mimetype: "audio/mpeg",
            fileName: `${session.title}.mp3`,
            ptt: false,
            caption: `🎧 ${session.title}`,
          },
          { quoted: mek }
        );
      }

      delete sessions[from];
    } catch (e) {
      console.error(e);
      reply("❌ *Failed to send audio.*");
    }
  }
);

// Reply "2" = send as document no size limit
cmd(
  {
    pattern: "2",
    on: "number",
    dontAddCommandList: true,
  },
  async (robin, mek, m, { from, reply }) => {
    const session = sessions[from];
    if (!session || session.step !== "choose_send_type") return;

    try {
      await robin.sendMessage(
        from,
        {
          document: { url: session.url },
          mimetype: "audio/mpeg",
          fileName: `${session.title}.mp3`,
          caption: "📁 Full audio file (document)",
        },
        { quoted: mek }
      );

      delete sessions[from];
    } catch (e) {
      console.error(e);
      reply("❌ *Failed to send document.*");
    }
  }
);
