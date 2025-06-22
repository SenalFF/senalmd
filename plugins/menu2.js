const { cmd } = require('../command');

cmd({
    pattern: 'menu3',
    desc: 'Display the command menu with buttons',
    category: 'main',
    react: '📖'
}, async (m, conn) => {

    const sections = [
        {
            title: "🌟 MAIN CATEGORIES",
            rows: [
                { title: "🎵 Song Downloader", rowId: ".song" },
                { title: "🎬 Video Downloader", rowId: ".video" },
                { title: "📦 APK Downloader", rowId: ".apk" },
                { title: "🧩 Sticker Maker", rowId: ".sticker" }
            ]
        },
        {
            title: "🧪 BOT FUNCTIONS",
            rows: [
                { title: "✅ Bot Alive Check", rowId: ".alive" },
                { title: "📜 Help Commands", rowId: ".help" },
                { title: "📦 Check Updates", rowId: ".update" }
            ]
        }
    ];

    const listMessage = {
        text: '*MR SENAL CONTROL CMDz*\n\nSelect a category below 👇',
        footer: 'ɢᴇɴᴇʀᴀᴛᴇᴅ ʙʏ ᴍʀ ꜱᴇɴᴀʟ',
        title: '📂 MENU',
        buttonText: 'Select Category',
        sections
    };

    await conn.sendMessage(m.chat, listMessage); // 🔧 No 'quoted'
});
