const { cmd } = require('../command');

// Main Menu
cmd({
    pattern: "menu",
    desc: "Show the bot menu",
    category: "menu",
    react: "🧚‍♀️",
    filename: __filename
}, async (conn, mek, m, {
    from, reply, pushname
}) => {
    try {
        const text = `╭──🎀 *Hi ${pushname}!* 🎀
│📋 Select a category:
│
│1️⃣ Owner
│2️⃣ Fun
│3️⃣ Converter
│4️⃣ AI
│5️⃣ Group
│6️⃣ Download
│7️⃣ Main
│8️⃣ Anime
│9️⃣ Other
╰─────────────━┈⊷

_Reply with a number to view its commands._`;

        await reply(text);
    } catch (e) {
        console.log(e);
        reply(`${e}`);
    }
});


// 1️⃣ Owner Commands
cmd({ pattern: "^1$", desc: "Owner section", category: "menu", filename: __filename }, async (conn, mek, m, { reply }) => {
    await reply(`👑 *Owner Commands*:\n\n◆ .owner\n◆ .menu\n◆ .block`);
});

// 2️⃣ Fun Commands
cmd({ pattern: "^2$", desc: "Fun section", category: "menu", filename: __filename }, async (conn, mek, m, { reply }) => {
    await reply(`🎮 *Fun Commands*:\n\n◆ .fack\n◆ .dog`);
});

// 3️⃣ Converter Commands
cmd({ pattern: "^3$", desc: "Converter section", category: "menu", filename: __filename }, async (conn, mek, m, { reply }) => {
    await reply(`🛠️ *Converter Commands*:\n\n◆ .sticker`);
});

// 4️⃣ AI Commands
cmd({ pattern: "^4$", desc: "AI section", category: "menu", filename: __filename }, async (conn, mek, m, { reply }) => {
    await reply(`🤖 *AI Commands*:\n\n◆ .ai\n◆ .gpt4\n◆ .bing`);
});

// 5️⃣ Group Commands
cmd({ pattern: "^5$", desc: "Group section", category: "menu", filename: __filename }, async (conn, mek, m, { reply }) => {
    await reply(`👥 *Group Commands*:\n\n◆ .linkgroup\n◆ .setppgc\n◆ .setname\n◆ .setdesc\n◆ .group\n◆ .setgoodbuy\n◆ .setwelcome\n◆ .add\n◆ .remove\n◆ .promote\n◆ .demote\n◆ .unmute\n◆ .mute\n◆ .del`);
});

// 6️⃣ Download Commands
cmd({ pattern: "^6$", desc: "Download section", category: "menu", filename: __filename }, async (conn, mek, m, { reply }) => {
    await reply(`📥 *Download Commands*:\n\n◆ .facebook\n◆ .mediafire\n◆ .gdrive\n◆ .insta\n◆ .song\n◆ .video\n◆ .ytmp3doc\n◆ .ytmp4doc\n◆ .tiktok`);
});

// 7️⃣ Main Commands
cmd({ pattern: "^7$", desc: "Main section", category: "menu", filename: __filename }, async (conn, mek, m, { reply }) => {
    await reply(`⚙️ *Main Commands*:\n\n◆ .ping\n◆ .alive\n◆ .owner\n◆ .menu\n◆ .repo`);
});

// 8️⃣ Anime Commands
cmd({ pattern: "^8$", desc: "Anime section", category: "menu", filename: __filename }, async (conn, mek, m, { reply }) => {
    await reply(`🌸 *Anime Commands*:\n\n◆ .loli\n◆ .waifu\n◆ .neko\n◆ .megumin\n◆ .maid\n◆ .awoo`);
});

// 9️⃣ Other Commands
cmd({ pattern: "^9$", desc: "Other section", category: "menu", filename: __filename }, async (conn, mek, m, { reply }) => {
    await reply(`✨ *Other Commands*:\n\n◆ .trt\n◆ .news\n◆ .movie`);
});
