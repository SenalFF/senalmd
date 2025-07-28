const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");
const { ytmp4 } = require("@kelvdra/scraper");

// Streamtape API Credentials
const STREAMTAPE_USER = "23f14c5519cc5e3175ca";
const STREAMTAPE_KEY = "OkWybJzO6ah6K4";

const MAX_INLINE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

// Upload a file directly from URL to Streamtape
async function uploadToStreamtape(directUrl) {
    const apiUrl = `https://api.streamtape.com/file/ul?login=${STREAMTAPE_USER}&key=${STREAMTAPE_KEY}&url=${encodeURIComponent(directUrl)}`;
    const res = await axios.get(apiUrl);
    if (res.data.status !== 200) throw new Error("Upload failed");
    return res.data.result.url;
}

cmd({
    pattern: "vdb",
    desc: "Download and stream YouTube video using Streamtape",
    type: "downloader",
    fromMe: true,
}, async (message, match) => {
    if (!match) return await message.reply("🔍 Please provide a search term or YouTube link!");

    try {
        await message.reply("⏬ Fetching download link...");

        let result;
        if (match.includes("youtube.com") || match.includes("youtu.be")) {
            result = await ytmp4(match);
        } else {
            const search = await yts(match);
            if (!search.videos.length) throw new Error("No results found");
            result = await ytmp4(search.videos[0].url);
        }

        if (!result || !result.url) throw new Error("Failed to extract download link");

        await message.reply("📤 Uploading to Streamtape...");

        const streamtapeLink = await uploadToStreamtape(result.url);
        if (!streamtapeLink) throw new Error("Streamtape upload failed");

        await message.reply(`📡 Streaming to WhatsApp as document...\n${streamtapeLink}`);
    } catch (e) {
        console.error(e);
        await message.reply("❌ Failed to process video. Please try again later.");
    }
});
