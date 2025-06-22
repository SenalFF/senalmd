const {cmd , commands} = require('../command') // same as alive.js path

// Main menu command
cmd({
    pattern: "menu2",
    desc: "Show command categories",
    category: "main",
    react: "📋",
    filename: __filename
}, async (conn, mek, m, {
    from, reply, pushname
}) => {
    try {
        const menuText = `📋 *Command Menu* — Hello ${pushname}

1️⃣ Download  
2️⃣ Search  
3️⃣ Converter  
4️⃣ Owner  
5️⃣ Check

_Reply with a number (e.g., just send "1") to view commands in that category._`;

        return await reply(menuText);
    } catch (e) {
        console.log(e);
        reply(`${e}`);
    }
});

// Option 1 - Download category
cmd({
    pattern: "^1$",
    desc: "Reply option for download section",
    category: "main",
    react: "📥",
    filename: __filename
}, async (conn, mek, m, {
    from, reply
}) => {
    try {
        const downloadText = `📥 *Download Cmd*

▶️ *.play* — Play YouTube audio  
🎥 *.video* — Download YouTube video  
🎵 *.song* — Download song by title`;
        return await reply(downloadText);
    } catch (e) {
        console.log(e);
        reply(`${e}`);
    }
});
