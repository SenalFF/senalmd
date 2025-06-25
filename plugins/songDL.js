const { cmd } = require("../command");
const { search, playmp3 } = require("@kelvdra/scraper");

const sessions = {};

const SIZE_LIMIT = 16 * 1024 * 1024; // 16MB

cmd(
  {
    pattern: "play",
    desc: "YouTube Music Downloader (audio + doc)",
    category: "download",
    react: "🎵",
  },
  async (robin, mek, m, { q, from, reply }) => {
    if (!q) return reply("🔍 *YouTube ගීත නමක් හෝ ලින්ක් එකක් දාන්න...*");

    try {
      await robin.sendMessage(from, { text: "⏳ *Searching... Please wait...*" }, { quoted: mek });

      // 1. Search YouTube
      const results = await search(q);
      if (!results || !results.length) return reply("❌ *No results found for your query.*");

      const video = results[0]; // first search result

      // 2. Get mp3 info and URL
      const audioData = await playmp3(video.url);
      if (!audioData || !audioData.url) return reply("❌ *Audio download failed.*");

      // Store session info
      sessions[from] = {
        title: video.title,
        url: audioData.url,
        filesize: audioData.filesize || 0,
        duration: video.duration,
        step: "choose_send_type",
      };

      // Format filesize human readable
      function formatBytes(bytes) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024,
          sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
      }

      // 3. Send details + filesize
      const detailsMsg =
        `🎵 *Title:* ${video.title}\n` +
        `⏰ *Duration:* ${video.duration}\n` +
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

// Reply handler for options "1" or "2"
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
      // Check filesize under limit for audio preview
      if (session.filesize > SIZE_LIMIT) {
        // Too big, send as document + warn
        await robin.sendMessage(
          from,
          {
            document: { url: session.url },
            mimetype: "audio/mpeg",
            fileName: `${session.title}.mp3`,
            caption:
              "⚠️ *This file is too big to preview on WhatsApp.*\n" +
              "Sending as document instead.",
          },
          { quoted: mek }
        );
      } else {
        // Send as audio (preview)
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
      // Send as document (no size limit)
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
