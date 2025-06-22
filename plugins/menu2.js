const { cmd } = require('../command');

cmd({
    pattern: 'menu3',
    desc: 'Show bot button menu',
    category: 'menu',
    react: '📲',
    filename: __filename
}, async (conn, m, msg) => {
    const buttons = [
        { buttonId: 'songmenu', buttonText: { displayText: '🎵 Download Song' }, type: 1 },
        { buttonId: 'videomenu', buttonText: { displayText: '🎥 Download Video' }, type: 1 },
        { buttonId: 'apkmenu', buttonText: { displayText: '📱 Download APK' }, type: 1 },
        { buttonId: 'stickermenu', buttonText: { displayText: '✨ Sticker Maker' }, type: 1 },
        { buttonId: 'botcheck', buttonText: { displayText: '👤 Bot Check' }, type: 1 }
    ];

    const buttonMessage = {
        text: `╭─────『 *MR SENAL CONTROL CMDz* 』─────◆
│ Choose an option below:
╰─────────────◆

ɢᴇɴᴇʀᴀᴛᴇᴅ ʙʏ ᴍʀ ꜱᴇɴᴀʟ`,
        footer: 'Click a button below 👇',
        buttons: buttons,
        headerType: 1
    };

    // 🔧 FIX: Make sure to use `conn.sendMessage` and NOT `sendMessage` from args
    await conn.sendMessage(m.chat, buttonMessage, { quoted: m });
});
