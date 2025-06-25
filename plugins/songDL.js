const { cmd } = require("../command");
const yts = require("yt-search");
const youtubedl = require("youtube-dl-exec");
const axios = require("axios");

const sessions = {};

cmd({
  pattern: "play",
  desc: "YouTube Music Downloader",
  category: "download",
  react: "🎵"
}, async (robin, mek, m, { q, from, reply }) => {
  if (!q) return reply("🔍 *YouTube ගීත නමක් හෝ ලින්ක් එකක් දෙන්න...*");

  const result = await yts(q);
  const song = result.videos[0];
  if (!song) return reply("❌ ගීතය සොයාගන්න බැරි වුණා!");

  const { title, timestamp, views, author, url, thumbnail } = song;

  let info;
  try {
    info = await youtubedl(url, {
      dumpSingleJson: true,
      extractAudio: true,
      audioFormat: "mp3",
      cookieFile: "../system/cookies.txt"
    });
  } catch (err) {
    return reply(`❌ Download error: ${err.message}`);
  }

  const audioUrl = info.url;

  // Detect file size
  let sizeMB = 0;
  try {
    const head = await axios.head(audioUrl);
    sizeMB = Number(head.headers["content-length"] || 0) / (1024 * 1024);
  } catch (e) {
    console.warn("HEAD failed:", e.message);
  }

  sessions[from] = {
    title,
    audioUrl,
    isBig: sizeMB > 16,
    step: "choose_audio_send_type"
  };

  await robin.sendMessage(from, {
    image: { url: thumbnail },
    caption:
      `🎶 *Title:* ${title}\n` +
      `🎤 *Artist:* ${author.name}\n` +
      `⏱️ *Duration:* ${timestamp}\n` +
      `👁️ *Views:* ${views.toLocaleString()}\n` +
      `📦 *File Size:* ${sizeMB.toFixed(2)} MB\n\n` +
      `📥 *ඔබට ගීතය එවන්නෙ කොහොමද?*\n1. Audio (Preview)\n2. Document`
  }, { quoted: mek });
});

// 1 = Normal Audio
cmd({
  pattern: "1",
  on: "number",
  dontAddCommandList: true
}, async (robin, mek, m, { from }) => {
  const session = sessions[from];
  if (!session || session.step !== "choose_audio_send_type") return;

  if (session.isBig) {
    return robin.sendMessage(from, {
      text: `⚠️ ගීතය 16MB ට වඩා විශාලයි. Document එකක් විදියට එවන්න.\n👉 *Reply with 2 to continue.*`
    }, { quoted: mek });
  }

  await robin.sendMessage(from, {
    audio: { url: session.audioUrl },
    mimetype: "audio/mp4",
    fileName: `${session.title}.mp3`,
    caption: `🎧 *${session.title}*`
  }, { quoted: mek });

  delete sessions[from];
});

// 2 = Audio Document
cmd({
  pattern: "2",
  on: "number",
  dontAddCommandList: true
}, async (robin, mek, m, { from }) => {
  const session = sessions[from];
  if (!session || session.step !== "choose_audio_send_type") return;

  await robin.sendMessage(from, {
    document: { url: session.audioUrl },
    mimetype: "audio/mp4",
    fileName: `${session.title}.mp3`,
    caption: `✅ *Document ගීතය එවූවෙමි.*`
  }, { quoted: mek });

  delete sessions[from];
});
