const { command } = require('../command');

command({
    pattern: 'menuc',
    alias: ['help', 'commands'],
    desc: 'Show menu',
    function: async (conn, mek, m, { reply }) => {
        await reply('📋 Menu here...');
    }
});
