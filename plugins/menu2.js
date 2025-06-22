const { cmd } = require('../command');

cmd({
    pattern: 'menu3',
    desc: 'Show bot button menu with image',
    category: 'menu',
    react: '📲',
    filename: __filename
}, async (conn, m) => {
    const imageUrl = 'https://telegra.ph/file/f2be313fe820b56b47748.png';

    const buttons = [
        { buttonId: 'songmenu', buttonText: { displayText: '🎵 Download Song' }, type: 1 },
        { buttonId: 'videomenu', buttonText: { displayText: '🎥 Download Video' }, type: 1 },
        { buttonId: 'apkmenu', buttonText: { displayText: '📱 Download APK' }, type: 1 },
        { buttonId: 'stickermenu', buttonText: { displayText: '✨ Sticker Maker' }, type: 1 },
        { buttonId: 'botcheck', buttonText: { displayText: '👤 Bot Check' }, type: 1 }
    ];

    const buttonMessage = {
        image: { url: imageUrl },
        caption: `╭─────『 *MR SENAL CONTROL CMDz* 』─────◆
│ Choose an option below:
╰─────────────◆

🎵 .song [name] - Download audio  
🎥 .video [link] - Download video  
📱 .apk [app name] - Get APK file  
✨ .sticker - Create sticker  
👤 .botcheck - Check bot status  

_ɢᴇɴᴇʀᴀᴛᴇᴅ ʙʏ ᴍʀ ꜱᴇɴᴀʟ_`,
        footer: 'Click a button below 👇',
        buttons: buttons,
        headerType: 4
    };

    await conn.sendMessage(m.chat, buttonMessage); // ✅ No quoted
});
