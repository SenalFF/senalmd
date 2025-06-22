const { cmd, commands } = require('../command')

// Main Menu
cmd({
    pattern: "menu2",
    desc: "Show the bot menu",
    category: "menu",
    react: "Ⓜ️",
    filename: __filename
}, async (conn, mek, m, {
    from, reply, pushname
}) => {
    try {
        const text = `╭──🎀 *Hi ${pushname || "User"}!* 🎀
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

// Helper function to register reply patterns
const registerNumberReply = (num, title, cmds) => {
    cmd({
        pattern: `^${num}$`,
        desc: `${title} commands`,
        category: "menu",
        fromMe: false,
        dontAddCommandList: true,
        filename: __filename
    }, async (conn, mek, m, { reply }) => {
        await reply(`📂 *${title} Commands*:\n\n${cmds.map(c => `◆ ${c}`).join('\n')}`);
    });
};

// All reply sections
registerNumberReply("1", "Owner", [".owner", ".menu", ".block"]);
registerNumberReply("2", "Fun", [".fack", ".dog"]);
registerNumberReply("3", "Converter", [".sticker"]);
registerNumberReply("4", "AI", [".ai", ".gpt4", ".bing"]);
registerNumberReply("5", "Group", [
    ".linkgroup", ".setppgc", ".setname", ".setdesc", ".group",
    ".setgoodbuy", ".setwelcome", ".add", ".remove",
    ".promote", ".demote", ".unmute", ".mute", ".del"
]);
registerNumberReply("6", "Download", [
    ".facebook", ".mediafire", ".gdrive", ".insta", ".song", ".video",
    ".ytmp3doc", ".ytmp4doc", ".tiktok"
]);
registerNumberReply("7", "Main", [".ping", ".alive", ".owner", ".menu", ".repo"]);
registerNumberReply("8", "Anime", [".loli", ".waifu", ".neko", ".megumin", ".maid", ".awoo"]);
registerNumberReply("9", "Other", [".trt", ".news", ".movie"]);
