// Audio Downloader with got + axios fallback const { cmd } = require("../command"); const yts = require("yt-search"); const { ytmp3 } = require("@kelvdra/scraper"); const got = require("got"); const axios = require("axios");

const MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16MB WhatsApp limit const sessions = {};

// --- Downloader with got + axios fallback --- async function downloadFile(url) { try { const res = await got(url, { responseType: "buffer" }); return res.body; } catch (e1) { console.warn("got failed, trying axios..."); try { const res = await axios.get(url, { responseType: "arraybuffer" }); return Buffer.from(res.data); } catch (e2) { throw new Error("❌ Could not download file using got or axios."); } } }

// Send as audio async function sendAudio(robin, from, mek, buffer, title) { await robin.sendMessage( from, { audio: buffer, mimetype: "audio/mpeg", fileName: ${title.slice(0, 30)}.mp3, }, { quoted: mek } ); }

// Send as document async function sendDocument(robin, from, mek, buffer, title) { await robin.sendMessage( from, { document: buffer, mimetype: "audio/mpeg", fileName: ${title.slice(0, 30)}.mp3, caption: "✅ Document sent by SENAL MD ❤️", }, { quoted: mek } ); }

// .play command cmd( { pattern: "play", desc: "🎧 YouTube Audio Downloader", category: "download", react: "🎧", }, async (robin, mek, m, { from, q, reply }) => { try { if (!q) return reply("🔍 Please provide a song name or YouTube URL.");

await reply("🔎 Searching for your song...");
  const searchResult = await yts(q);
  const video = searchResult.videos[0];
  if (!video) return reply("❌ *No results found.*");

  const title = video.title;
  const url = video.url;

  await reply("🎧 Fetching download link...");
  const result = await ytmp3(url, "128");
  if (!result?.download?.url) return reply("❌ *Failed to fetch download link.*");

  const buffer = await downloadFile(result.download.url);
  const filesize = buffer.length;
  const filesizeMB = (filesize / (1024 * 1024)).toFixed(2);

  sessions[from] = {
    video,
    buffer,
    filesize,
    step: "choose_format",
  };

  const info = `

🎧 SENAL MD Song Downloader

🎶 Title: ${title} ⏱️ Duration: ${video.timestamp} 👁️ Views: ${video.views.toLocaleString()} 📤 Uploaded: ${video.ago} 📦 File Size: ${filesizeMB} MB 🔗 URL: ${url}

📁 Choose format: 1️⃣ Voice Note 2️⃣ Document ✍️ Reply with 1 or 2 `;

await robin.sendMessage(
    from,
    { image: { url: video.thumbnail }, caption: info },
    { quoted: mek }
  );
} catch (e) {
  console.error("Play Command Error:", e);
  return reply("❌ *An error occurred. Please try again later.*");
}

} );

// Reply: 1 cmd( { pattern: "1", on: "number", dontAddCommandList: true, }, async (robin, mek, m, { from, reply }) => { const session = sessions[from]; if (!session || session.step !== "choose_format") return;

session.step = "sending";

try {
  if (session.filesize > MAX_AUDIO_SIZE) {
    await reply("⚠️ File is too large for voice note. Sending as document...");
    await sendDocument(robin, from, mek, session.buffer, session.video.title);
  } else {
    await reply("🎵 Sending voice note...");
    await sendAudio(robin, from, mek, session.buffer, session.video.title);
  }
  await reply("✅ *Sent successfully!* 🎧");
} catch (e) {
  console.error("Audio send error:", e);
  await reply("❌ *Failed to send audio.*");
}

delete sessions[from];

} );

// Reply: 2 cmd( { pattern: "2", on: "number", dontAddCommandList: true, }, async (robin, mek, m, { from, reply }) => { const session = sessions[from]; if (!session || session.step !== "choose_format") return;

session.step = "sending";

try {
  await reply("📤 Sending as document...");
  await sendDocument(robin, from, mek, session.buffer, session.video.title);
  await reply("✅ *Document sent successfully!* 📄");
} catch (e) {
  console.error("Document send error:", e);
  await reply("❌ *Failed to send document.*");
}

delete sessions[from];

} );

