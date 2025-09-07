const { cmd } = require('../command');

cmd({
    pattern: "menub2",
    desc: "Bot command menu",
    category: "menu",
    react: "🧚‍♀️",
    filename: __filename
},

async (conn, mek, m, { from, reply }) => {
    try {
        const listMessage = {
            text: "🧚‍♀️ Welcome to *Şєᶰάℓ м𝐝 ✎♡* Menu",
            footer: "⚡ Powered by SENAL MD",
            title: "📜 Senal-MD Full Menu",
            buttonText: "✨ Open Menu",
            sections: [
                {
                    title: "👑 OWNER COMMANDS",
                    rows: [
                        { title: ".owner", rowId: "owner", description: "Show bot owner info" },
                        { title: ".block", rowId: "block", description: "Block a user" },
                        { title: ".menu", rowId: "menu", description: "Show this menu" },
                    ]
                },
                {
                    title: "🎭 FUN",
                    rows: [
                        { title: ".fack", rowId: "fack", description: "Generate a fake msg" },
                        { title: ".dog", rowId: "dog", description: "Random dog image" }
                    ]
                },
                {
                    title: "🎨 CONVERTER",
                    rows: [
                        { title: ".sticker", rowId: "sticker", description: "Convert image/video to sticker" }
                    ]
                },
                {
                    title: "🤖 AI COMMANDS",
                    rows: [
                        { title: ".ai", rowId: "ai", description: "AI chatbot" },
                        { title: ".gpt4", rowId: "gpt4", description: "ChatGPT-4" },
                        { title: ".bing", rowId: "bing", description: "Ask Bing AI" }
                    ]
                },
                {
                    title: "👥 GROUP MANAGEMENT",
                    rows: [
                        { title: ".linkgroup", rowId: "linkgroup", description: "Get group link" },
                        { title: ".setppgc", rowId: "setppgc", description: "Set group profile pic" },
                        { title: ".setname", rowId: "setname", description: "Set group name" },
                        { title: ".setdesc", rowId: "setdesc", description: "Set group description" },
                        { title: ".add", rowId: "add", description: "Add member" },
                        { title: ".remove", rowId: "remove", description: "Remove member" },
                        { title: ".promote", rowId: "promote", description: "Promote to admin" },
                        { title: ".demote", rowId: "demote", description: "Demote admin" }
                    ]
                },
                {
                    title: "📥 DOWNLOAD",
                    rows: [
                        { title: ".song", rowId: "song", description: "Download song" },
                        { title: ".video", rowId: "video", description: "Download video" },
                        { title: ".fbdl", rowId: "fbdl", description: "Facebook downloader" },
                        { title: ".insta", rowId: "insta", description: "Instagram downloader" },
                        { title: ".mfire", rowId: "mfire", description: "Mediafire downloader" },
                        { title: ".gdrive", rowId: "gdrive", description: "Google Drive downloader" },
                        { title: ".subdl", rowId: "subdl", description: "Subtitle downloader" }
                    ]
                },
                {
                    title: "✨ MAIN",
                    rows: [
                        { title: ".ping", rowId: "ping", description: "Check bot response" },
                        { title: ".alive", rowId: "alive", description: "Check if bot alive" },
                        { title: ".repo", rowId: "repo", description: "Get bot repo" }
                    ]
                },
                {
                    title: "🍥 ANIME",
                    rows: [
                        { title: ".loli", rowId: "loli", description: "Random loli pic" },
                        { title: ".waifu", rowId: "waifu", description: "Random waifu" },
                        { title: ".neko", rowId: "neko", description: "Random neko" },
                        { title: ".maid", rowId: "maid", description: "Maid anime pic" }
                    ]
                },
                {
                    title: "📡 OTHER",
                    rows: [
                        { title: ".trt", rowId: "trt", description: "Translate text" },
                        { title: ".news", rowId: "news", description: "Latest news" },
                        { title: ".movie", rowId: "movie", description: "Movie info" }
                    ]
                }
            ]
        };

        // Send the interactive list with ai: true
        await conn.sendMessage(from, { ...listMessage, ai: true }, { quoted: mek });

    } catch (e) {
        console.log(e);
        await conn.sendMessage(from, { text: `⚠️ Error: ${e}`, ai: true }, { quoted: mek });
    }
});
