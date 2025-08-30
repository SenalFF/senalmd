const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');

const { getBuffer, getGroupAdmins, Json, sleep, fetchJson } = require('./lib/functions');
const fs = require('fs');
const P = require('pino');
const config = require('./config');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const prefix = '.';
const ownerNumber = ['94769872326'];

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

async function connectToWA() {
    console.log("Connecting Senal MD BOT...");

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

    // Keep alive
    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                console.log("Reconnecting...");
                connectToWA();
            } else {
                console.log("Logged out. Please reauthenticate.");
            }
        } else if (connection === 'open') {
            console.log('Bot connected successfully ✅');

            // Load plugins
            const path = require('path');
            fs.readdirSync("./plugins/").forEach(plugin => {
                if (path.extname(plugin).toLowerCase() === ".js") {
                    require("./plugins/" + plugin);
                }
            });

            // Notify owner
            const up = `Senal-MD connected successfully ✅\nPREFIX: ${prefix}`;
            await conn.sendMessage(ownerNumber + "@s.whatsapp.net", {
                image: { url: `https://files.catbox.moe/gm88nn.png` },
                caption: up
            });
        }
    });

    conn.ev.on('creds.update', saveCreds);

    // Message handler
    conn.ev.on('messages.upsert', async (mek) => {
        mek = mek.messages[0];
        if (!mek.message) return;

        mek.message = getContentType(mek.message) === 'ephemeralMessage'
            ? mek.message.ephemeralMessage.message
            : mek.message;

        const type = getContentType(mek.message);
        const from = mek.key.remoteJid;
        const body = type === 'conversation' ? mek.message.conversation
            : type === 'extendedTextMessage' ? mek.message.extendedTextMessage.text
            : type === 'imageMessage' && mek.message.imageMessage.caption ? mek.message.imageMessage.caption
            : type === 'videoMessage' && mek.message.videoMessage.caption ? mek.message.videoMessage.caption
            : '';

        const isCmd = body.startsWith(prefix);
        const commandText = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(isCmd ? 1 : 0);
        const q = args.join(' ');

        const isGroup = from.endsWith('@g.us');
        const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net') : (mek.key.participant || from);
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];
        const pushname = mek.pushName || 'No Name';
        const isOwner = ownerNumber.includes(senderNumber) || senderNumber === botNumber;

        // Reply helper
        const reply = (text, extra = {}) => conn.sendMessage(from, { text, ...extra }, { quoted: mek });

        // Button reply helper
        const sendButton = async (text, buttons, footer = 'Senal Bot') => {
            return await conn.sendMessage(from, {
                text,
                footer,
                buttons,
                headerType: 1
            }, { quoted: mek });
        };

        // Example: reply with buttons if command is "menu"
        if (isCmd && commandText === 'menu') {
            const buttons = [
                { buttonId: '.help', buttonText: { displayText: 'Help' }, type: 1 },
                { buttonId: '.about', buttonText: { displayText: 'About' }, type: 1 }
            ];
            return sendButton('Select an option:', buttons);
        }

        // Load commands module
        const events = require('./command');

        // Handle prefix commands
        const cmd = isCmd
            ? events.commands.find(c => c.pattern === commandText || (c.alias && c.alias.includes(commandText)))
            : null;

        if (cmd) {
            try {
                await cmd.function(conn, mek, { body, args, q, from, sender, reply, sendButton });
            } catch (e) {
                console.error("[PLUGIN ERROR]", e);
                reply("⚠️ An error occurred while executing the command.");
            }
            return;
        }

        // Handle body commands
        events.commands.forEach(async command => {
            if (body && command.on === 'body') {
                try {
                    await command.function(conn, mek, { body, args, q, from, sender, reply, sendButton });
                } catch (e) {
                    console.error("[BODY CMD ERROR]", e);
                }
            }
        });
    });

    return conn;
}

// Express server
app.get("/", (req, res) => res.send("Hey, Senal started ✅"));
app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));

// Start bot
setTimeout(connectToWA, 4000);
