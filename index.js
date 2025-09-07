// ======================== IMPORTS ========================
const {  
    default: makeWASocket,  
    useMultiFileAuthState,  
    DisconnectReason,  
    jidNormalizedUser,  
    getContentType,  
    fetchLatestBaileysVersion,  
    Browsers  
} = require('@whiskeysockets/baileys');

const { getBuffer, getGroupAdmins, sleep } = require('./lib/functions');
const fs = require('fs');
const P = require('pino');
const config = require('./config');
const express = require("express");
const { sms } = require('./lib/msg');
const { File } = require('megajs');
const path = require('path');

const app = express();
const port = process.env.PORT || 8000;
const prefix = '.';
const ownerNumber = ['94769872326'];

// ==================== SESSION AUTH ====================
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (!config.SESSION_ID) return console.log('Please add your session to SESSION_ID env!!');
    const sessdata = config.SESSION_ID;
    const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
    filer.download((err, data) => {
        if (err) throw err;
        fs.writeFileSync(__dirname + '/auth_info_baileys/creds.json', data);
        console.log("✅ Session downloaded");
    });
}

// ==================== CONNECT FUNCTION ====================
async function connectToWA() {
    console.log("⏳ Connecting Senal-MD BOT...");
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.macOS("Firefox"),
        auth: state,
        version
    });

    // ==================== CONNECTION EVENTS ====================
    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                console.log("⚠️ Disconnected, reconnecting...");
                connectToWA();
            } else {
                console.log("❌ Logged out. Delete creds and reconnect.");
            }
        } else if (connection === 'open') {
            console.log('✅ Senal-MD connected');
            // Load plugins automatically
            fs.readdirSync("./plugins/").forEach(file => {
                if (path.extname(file).toLowerCase() === ".js") require(`./plugins/${file}`);
            });
            console.log("✅ Plugins loaded successfully");

            // Send owner a startup message
            const msg = `🤖 Senal-MD connected successfully ✅\n\nPREFIX: ${prefix}`;
            conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", { 
                image: { url: "https://files.catbox.moe/gm88nn.png" }, 
                caption: msg 
            });
        }
    });

    conn.ev.on('creds.update', saveCreds);

    // ==================== MESSAGE HANDLER ====================
    conn.ev.on('messages.upsert', async (mek) => {
        mek = mek.messages[0];
        if (!mek.message) return;

        mek.message = getContentType(mek.message) === 'ephemeralMessage' 
            ? mek.message.ephemeralMessage.message 
            : mek.message;

        const from = mek.key.remoteJid;
        const type = getContentType(mek.message);
        const body = (type === 'conversation') ? mek.message.conversation :
                     (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text :
                     (type === 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption :
                     (type === 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : '';

        const isCmd = body.startsWith(prefix);
        const commandText = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(isCmd ? 1 : 0);
        const q = args.join(' ');

        const isGroup = from.endsWith('@g.us');
        const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net') : (mek.key.participant || from);
        const senderNumber = sender.split('@')[0];
        const isOwner = ownerNumber.includes(senderNumber);

        const reply = (text, extra = {}) => conn.sendMessage(from, { text, ...extra }, { quoted: mek });

        // ==================== BUTTON HANDLER ====================
        if (mek.message.buttonsResponseMessage) {
            const btnId = mek.message.buttonsResponseMessage.selectedButtonId;
            if (btnId === "channel") reply("📢 Join Channel: https://whatsapp.com/channel/0029VbBUZc1LNSaBaZDjkJ1y");
            else if (btnId === "group") reply("👥 Join Group: https://chat.whatsapp.com/Ef9569Wpror1OAkWCFcE9q?mode=ems_share_t");
            else if (btnId === "owner") reply("📞 Contact Owner: https://wa.link/bgbwbp");
            return;
        }

        // ==================== COMMAND HANDLER ====================
        const events = require('./command');

        // Prefix commands
        const cmd = isCmd 
            ? (events.commands.find(c => c.pattern === commandText) || events.commands.find(c => c.alias && c.alias.includes(commandText))) 
            : null;
        if (cmd) {
            if (cmd.react) await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
            try { await cmd.function(conn, mek, sms(conn, mek), { from, body, isCmd, command: commandText, args, q, reply, isOwner, isGroup, sender }); }
            catch(e){ console.error("[PLUGIN ERROR]", e); reply("⚠️ Error executing the command."); }
            return;
        }

        // Number commands
        const numberCmd = events.commands.find(c => c.on === 'number' && c.pattern === body);
        if (numberCmd) {
            try { await numberCmd.function(conn, mek, sms(conn, mek), { from, body, isCmd: false, command: numberCmd.pattern, args: [], q: '', reply, isOwner, isGroup, sender }); }
            catch(e){ console.error("[NUMBER CMD ERROR]", e); reply("⚠️ Error executing number command."); }
            return;
        }

        // Body commands
        events.commands.forEach(async (command) => {
            if (body && command.on === "body") {
                try { await command.function(conn, mek, sms(conn, mek), { from, body, isCmd, command: command.pattern, args, q, reply, isOwner, isGroup, sender }); }
                catch(e){ console.error("[BODY CMD ERROR]", e); }
            }
        });
    });
}

// ==================== EXPRESS SERVER ====================
app.get("/", (req, res) => res.send("Hey, Senal started✅"));
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));

// ==================== START BOT ====================
setTimeout(connectToWA, 4000);
