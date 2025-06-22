const { cmd } = require('../command'); // adjust path

cmd({
    pattern: '1',
    on: 'number',
    desc: 'Download Song Menu',
    category: 'menu',
    dontAddCommandList: true
}, async (conn, m, msg, { reply }) => {
    await reply('🎵 *Download Song Selected*\nUse `.song <name>` to download music.');
});

cmd({
    pattern: '2',
    on: 'number',
    desc: 'Download Video Menu',
    category: 'menu',
    dontAddCommandList: true
}, async (conn, m, msg, { reply }) => {
    await reply('🎥 *Download Video Selected*\nUse `.video <name>` to download video.');
});

cmd({
    pattern: '3',
    on: 'number',
    desc: 'Download APK Menu',
    category: 'menu',
    dontAddCommandList: true
}, async (conn, m, msg, { reply }) => {
    await reply('📱 *Download APK Selected*\nUse `.apk <name>` to download APK.');
});

cmd({
    pattern: '4',
    on: 'number',
    desc: 'Sticker Maker',
    category: 'menu',
    dontAddCommandList: true
}, async (conn, m, msg, { reply }) => {
    await reply('✨ *Sticker Maker Selected*\nSend an image and type `.sticker`.');
});

cmd({
    pattern: '5',
    on: 'number',
    desc: 'Bot Check',
    category: 'menu',
    dontAddCommandList: true
}, async (conn, m, msg, { reply }) => {
    await reply('✅ *Senal Bot is Working Fine!*');
})
