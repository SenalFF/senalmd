const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const { getBuffer, getGroupAdmins, sms } = require('./lib/functions');
const fs = require('fs');
const P = require('pino');
const config = require('./config');
const qrcode = require('qrcode-terminal');
const express = require("express");
const path = require('path');

const prefix = '.';
const ownerNumber = ['94769872326'];

const app = express();
const port = process.env.PORT || 8000;

//===================SESSION-AUTH============================
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (!config.SESSION_ID) return console.log('Please add your session to SESSION_ID env!!');
    const { File } = require('megajs');
    const sessdata = config.SESSION_ID;
    const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
    filer.download((err, data) => {
        if (err) throw err;
        fs.writeFileSync(__dirname + '/auth_info_baileys/creds.json', data);
        console.log("Session downloaded ✅");
    });
}

//===================CONNECT============================
async function connectToWA() {
    console.log("Connecting Senal MD BOT ⏳️...");
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS("Firefox"),
        syncFullHistory: true,
        auth: state,
        version
    });

    //===================EVENTS============================
    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log("Disconnected:", lastDisconnect?.error || lastDisconnect);
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('Reconnecting...');
                connectToWA();
            } else {
                console.log('Logged out. Please re-authenticate!');
            }
        } else if (connection === 'open') {
            console.log('Bot connected to WhatsApp ✅');

            // Load plugins
            fs.readdirSync("./plugins/").forEach((plugin) => {
                if (path.extname(plugin).toLowerCase() === ".js") {
                    require("./plugins/" + plugin);
                }
            });
            console.log('Plugins installed successfully ✅');

            // Notify owner
            const msg = `Senal-MD connected successfully ✅\n\nPREFIX: ${prefix}`;
            conn.sendMessage(ownerNumber + "@s.whatsapp.net", {
                image: { url: 'https://files.catbox.moe/gm88nn.png' },
                caption: msg
            });
        }
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async (mek) => {
        mek = mek.messages[0];
        if (!mek.message) return;
        mek.message = (getContentType(mek.message) === 'ephemeralMessage') 
            ? mek.message.ephemeralMessage.message 
            : mek.message;

        // Auto-read status
        if (mek.key.remoteJid === 'status@broadcast' && config.AUTO_READ_STATUS === "true") {
            await conn.readMessages([mek.key]);
        }

        const m = sms(conn, mek);
        const type = getContentType(mek.message);
        const from = mek.key.remoteJid;
        const quoted = (type === 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo) 
            ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] 
            : [];

        const body = (type === 'conversation') ? mek.message.conversation : 
                     (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : 
                     (type === 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption : 
                     (type === 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : '';

        const isCmd = body.startsWith(prefix);
        const commandText = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(isCmd ? 1 : 0);
        const q = args.join(' ');
        const isGroup = from.endsWith('@g.us');
        const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net') : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const botNumber2 = await jidNormalizedUser(conn.user.id);
        const pushname = mek.pushName || 'No Name';
        const isMe = conn.user.id.includes(senderNumber);
        const isOwner = ownerNumber.includes(senderNumber) || isMe;

        const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(() => null) : null;
        const participants = groupMetadata?.participants || [];
        const groupAdmins = getGroupAdmins(participants);
        const isBotAdmins = groupAdmins.includes(botNumber2);
        const isAdmins = groupAdmins.includes(sender);

        const reply = (text, extra = {}) => conn.sendMessage(from, { text, ...extra }, { quoted: mek });

        // Load commands
        const events = require('./command');
        const cmd = isCmd 
            ? (events.commands.find(c => c.pattern === commandText) || events.commands.find(c => c.alias?.includes(commandText))) 
            : null;

        const numberCmd = events.commands.find(c => c.on === 'number' && c.pattern === body);

        // Execute prefix command
        if (cmd) {
            if (cmd.react) await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
            try {
                await cmd.function(conn, mek, m, { from, quoted, body, isCmd, command: commandText, args, q, isGroup, sender, senderNumber, botNumber2, pushname, isOwner, groupMetadata, participants, groupAdmins, isBotAdmins, isAdmins, reply });
            } catch (e) {
                console.error("[PLUGIN ERROR]", e);
                reply("⚠️ An error occurred while executing the command.");
            }
            return;
        }

        // Execute number command
        if (numberCmd) {
            try {
                await numberCmd.function(conn, mek, m, { from, quoted, body, isCmd: false, command: numberCmd.pattern, args: [], q: '', isGroup, sender, senderNumber, botNumber2, pushname, isOwner, groupMetadata, participants, groupAdmins, isBotAdmins, isAdmins, reply });
            } catch (e) {
                console.error("[NUMBER CMD ERROR]", e);
                reply("⚠️ An error occurred while executing the number command.");
            }
            return;
        }

        // Execute body-type commands
        events.commands.map(async (command) => {
            if (body && command.on === "body") {
                try {
                    await command.function(conn, mek, m, { from, quoted, body, isCmd, command: command.pattern, args, q, isGroup, sender, senderNumber, botNumber2, pushname, isOwner, groupMetadata, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                } catch (e) {
                    console.error("[BODY CMD ERROR]", e);
                }
            }
        });
    });
}

//===================SERVER============================
app.get("/", (req, res) => res.send("Hey, Senal started ✅"));
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));

//===================START BOT============================
setTimeout(connectToWA, 4000);
