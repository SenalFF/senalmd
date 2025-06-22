cmd({
    pattern: 'songmenu',
    on: 'body',
    desc: 'Triggered by 🎵 Download Song button',
    dontAddCommandList: true
}, async (conn, m) => {
    await conn.sendMessage(m.chat, {
        text: '🎶 Use `.song Daru Nalawanna` to download music.'
    });
});
