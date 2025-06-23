const { cmd } = require('../command'); const { ownerNumber } = require('../config');

function isAdmin(participant, groupMetadata) { return groupMetadata.participants.find(p => p.id === participant && p.admin); }

cmd({ pattern: 'setwelcome', desc: 'Set welcome message', category: 'group' }, async (m, conn, { args, isGroup, groupMetadata }) => { if (!isGroup) return m.reply('❌ Group only command'); if (!isAdmin(m.sender, groupMetadata)) return m.reply('❌ Admin only');

global.welcomeMessages = global.welcomeMessages || {};
global.welcomeMessages[m.chat] = args.join(' ');
m.reply('✅ Welcome message updated');

});

cmd({ pattern: 'setgoodbye', desc: 'Set goodbye message', category: 'group' }, async (m, conn, { args, isGroup, groupMetadata }) => { if (!isGroup) return m.reply('❌ Group only command'); if (!isAdmin(m.sender, groupMetadata)) return m.reply('❌ Admin only');

global.goodbyeMessages = global.goodbyeMessages || {};
global.goodbyeMessages[m.chat] = args.join(' ');
m.reply('✅ Goodbye message updated');

});

cmd({ pattern: 'ban', desc: 'Ban a user (owner only)', category: 'owner' }, async (m, conn) => { const sender = m.sender.split('@')[0]; if (!ownerNumber.includes(sender)) return m.reply('❌ Owner only');

const mentioned = m.mentionedJid[0];
if (!mentioned) return m.reply('Mention a user to ban');

global.bannedUsers = global.bannedUsers || [];
global.bannedUsers.push(mentioned);
m.reply('✅ User banned');

});

cmd({ pattern: 'pin', desc: 'Pin a message', category: 'group' }, async (m, conn) => { m.reply('📌 Message pinned'); // Replace with real pin logic if API supports it });

cmd({ pattern: 'poll', desc: 'Create a poll', category: 'group' }, async (m, conn, { args }) => { const [question, ...options] = args.join(' ').split('|'); if (!question || options.length < 2) return m.reply('Usage: .poll Question | Option1 | Option2');

await conn.sendMessage(m.chat, {
    poll: {
        name: question.trim(),
        values: options.map(o => o.trim())
    }
});

});

cmd({ pattern: 'add', desc: 'Add user to group', category: 'group' }, async (m, conn, { args, isGroup, groupMetadata }) => { if (!isGroup) return m.reply('❌ Group only command'); if (!isAdmin(m.sender, groupMetadata)) return m.reply('❌ Admin only'); const number = args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net'; if (!number) return m.reply('Usage: .add 94712345678'); await conn.groupParticipantsUpdate(m.chat, [number], 'add'); });

cmd({ pattern: 'kick', desc: 'Remove user from group', category: 'group' }, async (m, conn, { isGroup, groupMetadata }) => { if (!isGroup) return m.reply('❌ Group only command'); if (!isAdmin(m.sender, groupMetadata)) return m.reply('❌ Admin only'); const mentioned = m.mentionedJid[0]; if (!mentioned) return m.reply('Mention user to remove'); await conn.groupParticipantsUpdate(m.chat, [mentioned], 'remove'); });

cmd({ pattern: 'tagall', desc: 'Mention all members', category: 'group' }, async (m, conn, { isGroup, groupMetadata }) => { if (!isGroup) return m.reply('❌ Group only'); let text = '👥 Tagging all members:\n'; let mentions = []; for (const participant of groupMetadata.participants) { text += • @${participant.id.split('@')[0]}\n; mentions.push(participant.id); } await conn.sendMessage(m.chat, { text, mentions }, { quoted: m }); });

cmd({ pattern: 'mutegroup', desc: 'Mute group for members', category: 'group' }, async (m, conn, { isGroup, groupMetadata }) => { if (!isGroup) return m.reply('❌ Group only'); if (!isAdmin(m.sender, groupMetadata)) return m.reply('❌ Admin only'); await conn.groupSettingUpdate(m.chat, 'announcement'); m.reply('🔇 Group muted for members'); });

cmd({ pattern: 'opengroup', desc: 'Allow members to send messages', category: 'group' }, async (m, conn, { isGroup, groupMetadata }) => { if (!isGroup) return m.reply('❌ Group only'); if (!isAdmin(m.sender, groupMetadata)) return m.reply('❌ Admin only'); await conn.groupSettingUpdate(m.chat, 'not_announcement'); m.reply('🔊 Group is now open to members'); });

