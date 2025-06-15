sock.ev.on('messages.upsert', async (m) => {
    try {
        const message = m.messages[0];
        if (!message?.message?.buttonsResponseMessage) return;

        const btn = message.message.buttonsResponseMessage;
        const btnId = btn.selectedButtonId;
        const from = message.key.remoteJid;

        if (btnId === 'download_menu') {
            await sock.sendMessage(from, {
                text: `🎵 *Download Menu:*\n\n⏩ *Song:* .song\n⏩ *Video:* .video`,
            });
        }

        // You can add other button responses similarly:
        else if (btnId === 'check_menu') {
            await sock.sendMessage(from, {
                text: `✅ *Check Menu:*\n\n.alive\n.restart`
            });
        }

        else if (btnId === 'search_menu') {
            await sock.sendMessage(from, {
                text: `🔍 *Search Menu:*\n\n🎬 Movie - .Smovie\n🎵 Song - .Song\n📺 Video - .video`
            });
        }

        else if (btnId === 'converter_menu') {
            await sock.sendMessage(from, {
                text: `🔄 *Converter Menu:*\n\n🖼️ Sticker - .sticker\n🎵 MP3 - .tomp3`
            });
        }

        else if (btnId === 'owner_menu') {
            await sock.sendMessage(from, {
                text: `👑 *Owner Menu:*\n\n👤 Developer - .owner`
            });
        }

    } catch (e) {
        console.log("Button handler error:", e);
    }
})
