const {cmd} = require('../command');

// Simple alive command for testing
cmd({
    pattern: "alive2",
    alias: ["test", "ping"],
    desc: "Check if bot is alive",
    category: "main",
    react: "✅",
    filename: __filename
},
async(conn, mek, m, {from, reply, pushname}) => {
    try {
        console.log('✅ Alive command executed!');
        
        const message = `
✅ *Bot is Alive!*

👤 User: ${pushname}
⏰ Time: ${new Date().toLocaleString()}
🤖 Status: Running
💫 Prefix: .

_Senal MD is working perfectly!_
        `;
        
        await reply(message);
        console.log('✅ Reply sent successfully');
        
    } catch(e) {
        console.error('❌ Error in alive command:', e);
        reply(`❌ Error: ${e.message}`);
    }
});

// Ultra simple test command
cmd({
    pattern: "test",
    desc: "Ultra simple test",
    react: "🧪",
    filename: __filename
},
async(conn, mek, m, {reply}) => {
    console.log('🧪 TEST COMMAND CALLED!');
    await reply('🧪 Test successful!');
});
