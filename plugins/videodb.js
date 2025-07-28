const { cmd } = require("../command"); const yts = require("yt-search"); const { ytmp4 } = require("@kelvdra/scraper"); const axios = require("axios");

const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB const STREAMTAPE_USER = "23f14c5519cc5e3175ca"; const STREAMTAPE_KEY = "OkWybJzO6ah6K4";

const sessions = {};

function formatBytes(bytes) { if (!bytes) return '0 Bytes'; const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; }

async function getFileSize(url) { try { const res = await axios.head(url, { timeout: 10000 }); return res.headers['content-length'] ? Number(res.headers['content-length']) : 0; } catch { return 0; } }

function sanitizeTitle(title) { return title.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_').slice(0, 50); }

async function uploadToStreamtape(directUrl) { const apiUrl = https://api.streamtape.com/file/ul?login=${STREAMTAPE_USER}&key=${STREAMTAPE_KEY}&url=${encodeURIComponent(directUrl)}; const res = await axios.get(apiUrl); if (res.data.status !== 200) throw new Error("Upload failed"); return res.data.result.url; }

cmd({ pattern: "vid", desc: "📥 YouTube Video Downloader (Streamtape Method)", category: "download", react: "📹", }, async (robin, mek, m, { q, reply }) => { if (!q) return reply("🔍 Please provide a video name or YouTube link."); const from = mek.key.remoteJid;

try { await reply("🔎 Searching video on YouTube..."); const search = await yts(q); const video = search.videos[0]; if (!video) return reply("❌ Video not found.");

await reply("⏬ Fetching download link...");
const result = await ytmp4(video.url, "360");
if (!result?.download?.url) return reply("❌ Could not get download link.");

const downloadUrl = result.download.url;
const fileSize = await getFileSize(downloadUrl);
const sizeFormatted = fileSize > 0 ? formatBytes(fileSize) : "Unknown";
const safeTitle = sanitizeTitle(video.title);
const fileName = `${safeTitle}.mp4`;

await reply("📤 Uploading to Streamtape...");
const streamtapeUrl = await uploadToStreamtape(downloadUrl);

await reply("📡 Streaming to WhatsApp as document...");
const response = await axios.get(streamtapeUrl, { responseType: "stream" });
const mime = response.headers['content-type'] || 'video/mp4';

await robin.sendMessage(from, {
  document: { stream: response.data },
  mimetype: mime,
  fileName,
  caption: `🎬 *${video.title}*\n📦 *Size:* ${sizeFormatted}`,
}, { quoted: mek });

} catch (err) { console.error("Error:", err); reply("❌ Failed to process video."); } });

