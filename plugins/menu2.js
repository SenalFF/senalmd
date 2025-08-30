const { cmd } = require('../command');

cmd({
    pattern: "mn2",
    desc: "Display the bot menu with buttons",
    category: "menu",
    react: "🧚‍♀️",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        // Buttons
        const buttons = [
            { buttonId: 'song', buttonText: { displayText: '🎵 Download Song' }, type: 1 },
            { buttonId: 'video', buttonText: { displayText: '🎥 Download Video' }, type: 1 },
            { buttonId: 'apk', buttonText: { displayText: '📱 Download APK' }, type: 1 },
            { buttonId: 'sticker', buttonText: { displayText: '✨ Sticker Maker' }, type: 1 },
            { buttonId: 'botcheck', buttonText: { displayText: '👤 Bot Check' }, type: 1 }
        ];

        // Button message
        const buttonMessage = {
            image: { url: "https://files.catbox.moe/gm88nn.png" }, // menu banner
            caption: "╭─────『 *MR SENAL CONTROL CMDz* 』─────◆\n│\n│  Select an option below 👇\n╰─────────────◆\n\n╰─⧼ ɢᴇɴᴇʀᴀᴛᴇᴅ ʙʏ ᴍʀ ꜱᴇɴᴀʟ ⧽",
            footer: "MR SENAL CONTROL CMDz",
            buttons: buttons,
            headerType: 4 // 4 = image header
        };

        await conn.sendMessage(from, buttonMessage, { quoted: mek });

    } catch (e) {
        console.log(e);
        reply(`⚠️ Error: ${e}`);
    }
});
