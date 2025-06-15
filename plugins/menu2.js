const { cmd } = require('../command');

cmd({
    pattern: "menu2",
    desc: "Simple category menu",
    category: "menu",
    react: "📋",
    filename: __filename
},
async (conn, m, { reply }) => {
    try {
        const buttons = [
            {
                buttonId: 'check_menu',
                buttonText: { displayText: '✅ Check Menu' },
                type: 1
            },
            {
                buttonId: 'download_menu',
                buttonText: { displayText: '⬇️ Download Menu' },
                type: 1
            },
            {
                buttonId: 'search_menu',
                buttonText: { displayText: '🔍 Search Menu' },
                type: 1
            },
            {
                buttonId: 'converter_menu',
                buttonText: { displayText: '🔄 Converter Menu' },
                type: 1
            },
            {
                buttonId: 'owner_menu',
                buttonText: { displayText: '👑 Owner Menu' },
                type: 1
            }
        ];

        const buttonMessage = {
            text: '*📂 Select a Category Menu:*',
            buttons: buttons,
            headerType: 1
        };

        await conn.sendMessage(m.from, buttonMessage, { quoted: m });
    } catch (e) {
        console.log(e);
        reply('❌ Error showing menu.');
    }
});
