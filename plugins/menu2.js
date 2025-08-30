const { cmd } = require('../command');

cmd({
    pattern: "menu2",
    desc: "menu the bot",
    category: "menu",
    react: "🧚‍♀️",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        // Main menu buttons
        const buttons = [
            { buttonId: ".Owner", buttonText: { displayText: "👨‍💻 Owner" }, type: 1 },
            { buttonId: ".Fun", buttonText: { displayText: "🎮 Fun" }, type: 1 },
            { buttonId: ".Converter", buttonText: { displayText: "🛠 Converter" }, type: 1 },
            { buttonId: ".AI", buttonText: { displayText: "🤖 AI" }, type: 1 },
            { buttonId: ".Group", buttonText: { displayText: "👥 Group" }, type: 1 },
            { buttonId: ".Download", buttonText: { displayText: "⬇ Download" }, type: 1 },
            { buttonId: ".Anime", buttonText: { displayText: "🌸 Anime" }, type: 1 },
            { buttonId: ".Other", buttonText: { displayText: "🔹 Other" }, type: 1 }
        ];

        const buttonMessage = {
            image: { url: "https://files.catbox.moe/gm88nn.png" },
            caption: `
🧚‍♀️ *Bot Name*: 😈🏆 Şєᶰάℓ м𝐝 ✎♡
👨‍💻 *Owner*: Mr Senal
👤 *Number*: 0769872xxx
🧬 *Version*: 1.0.0
💻 *Host*: fv-az661-842
💫 *Prefix*: .
            
> © POWERED BY SENAL MD
            `,
            footer: "Select an option below 👇",
            buttons: buttons,
            headerType: 4
        };

        await conn.sendMessage(from, buttonMessage, { quoted: mek });
    } catch (e) {
        console.log(e);
        reply(`⚠️ Error: ${e}`);
    }
});
