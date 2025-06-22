const { cmd, commands } = require('../command');

cmd({
    pattern: "menu2",
    desc: "Display the bot's menu",
    category: "menu",
    react: "🧚‍♀️",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        // Define the list message for the main menu (categories)
        const menuMessage = {
            text: `😈🏆 Şєᶰάℓ м𝐝 ✎♡\n\n👨‍💻 Owner: Mr Senal\n📞 Number: 0769872xxx\n🧬 Version: 1.0.0\n💻 Host: fv-az661-842\n💫 Prefix: .`,
            footer: 'Reply with a number (1-9) to select a category.\n > © POWERED BY SENAL MD',
            title: 'Main Menu',
            buttonText: 'View Categories',
            sections: [
                {
                    title: 'Categories',
                    rows: [
                        { title: '1. Owner Commands', rowId: 'category_owner', description: 'Manage bot settings' },
                        { title: '2. Fun Commands', rowId: 'category_fun', description: 'Enjoy fun features' },
                        { title: '3. Converter Commands', rowId: 'category_converter', description: 'Convert media' },
                        { title: '4. AI Commands', rowId: 'category_ai', description: 'Interact with AI' },
                        { title: '5. Group Commands', rowId: 'category_group', description: 'Manage groups' },
                        { title: '6. Download Commands', rowId: 'category_download', description: 'Download media' },
                        { title: '7. Main Commands', rowId: 'category_main', description: 'Core features' },
                        { title: '8. Anime Commands', rowId: 'category_anime', description: 'Anime-themed features' },
                        { title: '9. Other Commands', rowId: 'category_other', description: 'Miscellaneous tools' },
                    ],
                },
            ],
            listType: 1,
        };

        // Send the list message with an image
        await conn.sendMessage(from, {
            image: { url: 'https://files.catbox.moe/gm88nn.png' },
            caption: menuMessage.text,
            footer: menuMessage.footer,
            title: menuMessage.title,
            buttonText: menuMessage.buttonText,
            sections: menuMessage.sections,
        }, { quoted: mek });

    } catch (e) {
        console.log(e);
        reply(`Error: ${e.message}`);
    }
});

// Handle category selection (new command to process replies)
cmd({
    pattern: "handle_menu",
    desc: "Handle menu selections",
    category: "menu",
    filename: __filename,
    hidden: true, // Hide from menu to avoid clutter
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        // Check if the message is a list response or a numeric reply
        let selectedOption = m.message.listResponseMessage?.singleSelectReply?.selectedRowId || body.trim();

        // Define sub-menus for each category
        const subMenus = {
            category_owner: {
                text: 'Owner Commands',
                rows: [
                    { title: '1. Owner', rowId: 'cmd_owner', description: 'Owner info' },
                    { title: '2. Menu', rowId: 'cmd_menu', description: 'Show menu' },
                    { title: '3. Block', rowId: 'cmd_block', description: 'Block user' },
                ],
            },
            category_fun: {
                text: 'Fun Commands',
                rows: [
                    { title: '1. Fack', rowId: 'cmd_fack', description: 'Fun fack command' },
                    { title: '2. Dog', rowId: 'cmd_dog', description: 'Dog-related fun' },
                ],
            },
            category_converter: {
                text: 'Converter Commands',
                rows: [
                    { title: '1. Sticker', rowId: 'cmd_sticker', description: 'Convert to sticker' },
                ],
            },
            category_ai: {
                text: 'AI Commands',
                rows: [
                    { title: '1. Ai', rowId: 'cmd_ai', description: 'General AI' },
                    { title: '2. Gpt4', rowId: 'cmd_gpt4', description: 'GPT-4 AI' },
                    { title: '3. Bing', rowId: 'cmd_bing', description: 'Bing AI' },
                ],
            },
            category_group: {
                text: 'Group Commands',
                rows: [
                    { title: '1. LinkGroup', rowId: 'cmd_linkgroup', description: 'Get group link' },
                    { title: '2. Setppgc', rowId: 'cmd_setppgc', description: 'Set group picture' },
                    { title: '3. Setname', rowId: 'cmd_setname', description: 'Set group name' },
                    { title: '4. Setdesc', rowId: 'cmd_setdesc', description: 'Set group description' },
                    { title: '5. Group', rowId: 'cmd_group', description: 'Group settings' },
                    { title: '6. Setgoodbye', rowId: 'cmd_setgoodbye', description: 'Set goodbye message' },
                    { title: '7. Setwelcome', rowId: 'cmd_setwelcome', description: 'Set welcome message' },
                    { title: '8. Add', rowId: 'cmd_add', description: 'Add member' },
                    { title: '9. Remove', rowId: 'cmd_remove', description: 'Remove member' },
                    { title: '10. Promote', rowId: 'cmd_promote', description: 'Promote member' },
                ],
            },
            category_download: {
                text: 'Download Commands',
                rows: [
                    { title: '1. Facebook', rowId: 'cmd_facebook', description: 'Download from Facebook' },
                    { title: '2. Mediafire', rowId: 'cmd_mediafire', description: 'Download from Mediafire' },
                    { title: '3. Gdrive', rowId: 'cmd_gdrive', description: 'Download from Google Drive' },
                    { title: '4. Insta', rowId: 'cmd_insta', description: 'Download from Instagram' },
                    { title: '5. Song', rowId: 'cmd_song', description: 'Download song' },
                    { title: '6. Video', rowId: 'cmd_video', description: 'Download video' },
                    { title: '7. Ytmp3doc', rowId: 'cmd_ytmp3doc', description: 'YouTube MP3' },
                    { title: '8. Ytmp4doc', rowId: 'cmd_ytmp4doc', description: 'YouTube MP4' },
                    { title: '9. Tiktok', rowId: 'cmd_tiktok', description: 'Download from TikTok' },
                ],
            },
            category_main: {
                text: 'Main Commands',
                rows: [
                    { title: '1. Ping', rowId: 'cmd_ping', description: 'Check bot speed' },
                    { title: '2. Alive', rowId: 'cmd_alive', description: 'Check bot status' },
                    { title: '3. Owner', rowId: 'cmd_owner', description: 'Owner info' },
                    { title: '4. Menu', rowId: 'cmd_menu', description: 'Show menu' },
                    { title: '5. Repo', rowId: 'cmd_repo', description: 'Bot repository' },
                ],
            },
            category_anime: {
                text: 'Anime Commands',
                rows: [
                    { title: '1. Loli', rowId: 'cmd_loli', description: 'Loli anime' },
                    { title: '2. Waifu', rowId: 'cmd_waifu', description: 'Waifu anime' },
                    { title: '3. Neko', rowId: 'cmd_neko', description: 'Neko anime' },
                    { title: '4. Megumin', rowId: 'cmd_megumin', description: 'Megumin anime' },
                    { title: '5. Maid', rowId: 'cmd_maid', description: 'Maid anime' },
                    { title: '6. Awoo', rowId: 'cmd_awoo', description: 'Awoo anime' },
                ],
            },
            category_other: {
                text: 'Other Commands',
                rows: [
                    { title: '1. Trt', rowId: 'cmd_trt', description: 'Translation' },
                    { title: '2. News', rowId: 'cmd_news', description: 'Latest news' },
                    { title: '3. Movie', rowId: 'cmd_movie', description: 'Movie info' },
                ],
            },
        };

        // Handle category selection
        if (subMenus[selectedOption]) {
            const subMenu = subMenus[selectedOption];
            await conn.sendMessage(from, {
                text: subMenu.text,
                footer: 'Reply with a number to select a command.\n > © POWERED BY SENAL MD',
                title: subMenu.text,
                buttonText: 'View Commands',
                sections: [{ title: subMenu.text, rows: subMenu.rows }],
                listType: 1,
            }, { quoted: mek });
            return;
        }

        // Handle command selection
        if (selectedOption && selectedOption.startsWith('cmd_')) {
            const command = selectedOption.replace('cmd_', '.').toLowerCase();
            await conn.sendMessage(from, { text: `Executing ${command}` }, { quoted: mek });
            // Trigger the command (assumes your command system supports this)
            // You may need to adjust this based on how your `cmd` system works
            const cmdEvent = { ...m, message: { conversation: command } };
            commands.find(c => c.pattern === command.replace('.', ''))?.function(conn, cmdEvent, m, { from, quoted, body: command, isCmd: true, command, args: [], q: '', isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
            return;
        }

        // Handle numeric replies for main menu
        const numericMap = {
            '1': 'category_owner',
            '2': 'category_fun',
            '3': 'category_converter',
            '4': 'category_ai',
            '5': 'category_group',
            '6': 'category_download',
            '7': 'category_main',
            '8': 'category_anime',
            '9': 'category_other',
        };

        if (numericMap[selectedOption]) {
            const subMenu = subMenus[numericMap[selectedOption]];
            await conn.sendMessage(from, {
                text: subMenu.text,
                footer: 'Reply with a number to select a command.\n > © POWERED BY SENAL MD',
                title: subMenu.text,
                buttonText: 'View Commands',
                sections: [{ title: subMenu.text, rows: subMenu.rows }],
                listType: 1,
            }, { quoted: mek });
            return;
        }

        // Invalid selection
        if (selectedOption) {
            await conn.sendMessage(from, { text: 'Invalid selection. Please reply with a valid number.' }, { quoted: mek });
        }

    } catch (e) {
        console.log(e);
        reply(`Error: ${e.message}`);
    }
});
