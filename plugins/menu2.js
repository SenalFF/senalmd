const { proto } = require('@whiskeysockets/baileys');

module.exports = {
    pattern: 'menu2',
    alias: ['help2'],
    desc: 'Show Senal MD Menu',
    react: '📑',
    category: 'Main',
    use: '.menu2',
    async function(conn, m, mData) {
        try {
            const { pushname, sender, from } = mData;

            const menuText = `
┌──『 *Senal-MD Menu* 』
│👤 User: ${pushname}
│📱 Number: wa.me/${sender.split('@')[0]}
│🔰 Prefix: .
├────────────────────
│ 1. .alive
│ 2. .song [name]
│ 3. .video [name]
│ 4. .apk [name]
│ 5. .sticker
│ 6. .photo [url]
├────────────────────
│ 7. Bot Check 🔍
└──────
            `.trim();

            const buttons = [
                { buttonId: '.alive', buttonText: { displayText: '🟢 Bot Alive' }, type: 1 },
                { buttonId: '.song wow', buttonText: { displayText: '🎵 Download Song' }, type: 1 },
                { buttonId: '.video wow', buttonText: { displayText: '🎥 Download Video' }, type: 1 },
                { buttonId: '.apk tiktok', buttonText: { displayText: '📲 Download APK' }, type: 1 },
                { buttonId: '.sticker', buttonText: { displayText: '✨ Sticker Maker' }, type: 1 },
                { buttonId: '.menu', buttonText: { displayText: '📋 Classic Menu' }, type: 1 },
            ];

            await conn.sendMessage(from, {
                text: menuText,
                footer: 'ɢᴇɴᴇʀᴀᴛᴇᴅ ʙʏ ᴍʀ ꜱᴇɴᴀʟ',
                buttons: buttons,
                headerType: 1
            }, { quoted: m });

        } catch (e) {
            console.log('💥 MENU ERROR:', e);
            conn.sendMessage(m.chat, { text: '❌ Error showing menu, check console.' }, { quoted: m });
        }
    }
};
