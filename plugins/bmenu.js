const { cmd } = require('../command'); // adjust path if needed

cmd({
    pattern: 'menu2',
    desc: 'Show bot command menu',
    category: 'menu',
    react: '📃',
    filename: __filename
}, async (conn, m, msg, { reply }) => {
    const menu = `
╭─────『 *MR SENAL CONTROL CMDz* 』─────◆
│
│  1. 🎵 Download Song
│  2. 🎥 Download Video
│  3. 📱 Download APK
│  4. ✨ Sticker Maker
│  5. 👤 Bot Check
│
╰─────────────◆

_Reply with a number to continue..._

╰─⧼ ɢᴇɴᴇʀᴀᴛᴇᴅ ʙʏ ᴍʀ ꜱᴇɴᴀʟ ⧽
    `;

    await reply(menu);
});
