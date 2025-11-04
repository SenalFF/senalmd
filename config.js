const fs = require("fs");
require("dotenv").config();

module.exports = {
  //==========================================- AUTHENTICATION - CONFIGS -==================================================================
  
  // Use pairing code instead of QR code (recommended)
  USE_PAIRING_CODE: process.env.USE_PAIRING_CODE || "true",
  
  // Your WhatsApp number for pairing code (without +, -, or ())
  // Example: 94769872326 for Sri Lanka
  PAIRING_NUMBER: process.env.PAIRING_NUMBER || "94769872326",
  
  // Session ID from Mega.nz (leave empty for first time)
  SESSION_ID: process.env.SESSION_ID || "",
  // After first connection, get the session link from mega_session_link.txt
  // Extract: https://mega.nz/file/ABC123#XYZ789 -> use: ABC123#XYZ789
  
  // Mega.nz credentials for auto backup
  MEGA_EMAIL: process.env.MEGA_EMAIL || "mrsenalff@gmail.com",
  MEGA_PASSWORD: process.env.MEGA_PASSWORD || "Sriyantha11@#",
  
  //==========================================- MAIN - CONFIGS -==================================================================
  
  // MongoDB Database URL
  MONGODB: process.env.MONGODB || "mongodb+srv://senalmd:sena1122@cluster0.pukovzb.mongodb.net/",
  
  // Bot Prefix
  PREFIX: process.env.PREFIX || ".",
  
  // Bot Mode
  mode: process.env.mode || "public",
  // private = Only Working For Owner Number
  // public = Anyone can use
  // inbox = Only Working in Inbox
  // groups = Only working in groups
  
  // Owner Number (without + or -)
  OWNER_NUMBER: process.env.OWNER_NUMBER || "94769872326",
  
  //========================================- OTHER - CONFIGS -=====================================================================
  
  AUTO_VOICE: process.env.AUTO_VOICE || "true",
  ANTI_BAD_WORDS_ENABLED: process.env.ANTI_BAD_WORDS_ENABLED || "true",
  AUTO_READ_STATUS: process.env.AUTO_READ_STATUS || "true",
  ANTI_BAD_WORDS: (process.env.ANTI_BAD_WORDS || "pakayo,huththo").split(','),
  ANTI_LINK: process.env.ANTILINK || "true",
  ALWAYS_ONLINE: process.env.ALWAYS_ONLINE || "false",
  AUTO_READ_CMD: process.env.AUTO_READ_CMD || "true",
  ALWAYS_TYPING: process.env.ALWAYS_TYPING || "false",
  ALWAYS_RECORDING: process.env.ALWAYS_RECORDING || "false",
  ANTI_BOT: process.env.ANTI_BOT || "true",
  ANTI_DELETE: process.env.ANTI_DELETE || "true",
  
  // Sticker Info
  packname: process.env.packname || "Senal MD",
  author: process.env.author || "ᴍr Senal🪀",
  
  //==========================================- API-CONFIGS -==========================================================
  
  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY || "2d61a72574c11c4f36173b627f8cb177", //openweathermap.org
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || "sk_6438bcc100d96458f8de0602aec662f4ba14b905fd090ad3", //elevenlabs.io
  SHODAN_API: process.env.SHODAN_API || "cbCkidr6qd7AFVaYs56MuCouGfM8gFki", //developer.shodan.io
  PEXELS_API_KEY: process.env.PEXELS_API_KEY || "39WCzaHAX939xiH22NCddGGvzp7cgbu1VVjeYUaZXyHUaWlL1LFcVFxH", // pexels.com
  OMDB_API_KEY: process.env.OMDB_API_KEY || "76cb7f39", // omdbapi.com
  PIXABAY_API_KEY: process.env.PIXABAY_API_KEY || "23378594-7bd620160396da6e8d2ed4d53", // pixabay.com
  ZIPCODEBASE_API_KEY: process.env.ZIPCODEBASE_API_KEY || "0f94a5f0-6ea4-11ef-81da-579be4fb031c", // zipcodebase.com
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || "AIzaSyD93IeJsouK51zjKgyHAwBIAlqr-a8mnME", 
  GOOGLE_CX: process.env.GOOGLE_CX || "AIzaSyD93IeJsouK51zjKgyHAwBIAlqr-a8mnME", 
  PASTEBIN_API_KEY: process.env.PASTEBIN_API_KEY || "uh8QvO6vQJGtIug9WvjdTAPx_ZAFJAxn",
  
  //==========================================- MESSAGES -=============================================================
  
  START_MSG: process.env.START_MSG || `*🚀 SENAL-MD V1 Connected Successfully!*

┌─────────────────────
│ ✅ Bot is Online
│ 💾 Session Auto-Backed Up
│ 🔐 Pairing Code Method
│ 📱 Ready to Receive Commands
└─────────────────────

_Type ${process.env.PREFIX || "."}menu to see commands_`,

  ALIVE_IMG: process.env.ALIVE_IMG || "https://files.catbox.moe/gm88nn.png",
  MENU_IMG: process.env.MENU_IMG || "https://files.catbox.moe/gm88nn.png",
  
  MENU_MSG: process.env.MENU_MSG || `╭━━━〔 *SENAL-MD* 〕━━━┈⊷
┃✵╭──────────────
┃✵│ *Owner:* ᴍr Senal🪀
┃✵│ *Prefix:* ${process.env.PREFIX || "."}
┃✵│ *Mode:* ${process.env.mode || "public"}
┃✵│ *Version:* 1.0.0
┃✵╰──────────────
╰━━━━━━━━━━━━━━━┈⊷`,

  MENU_MS: process.env.MENU_MS || `menu 2`,
};

// Helper function to validate phone number format
function validatePhoneNumber(number) {
  // Remove all non-numeric characters
  const cleaned = number.replace(/\D/g, '');
  
  // Check if it's a valid number (should be between 10-15 digits)
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return cleaned;
  }
  
  throw new Error('Invalid phone number format. Use only numbers without +, -, or ()');
}

// Validate and export cleaned numbers
if (module.exports.PAIRING_NUMBER) {
  try {
    module.exports.PAIRING_NUMBER = validatePhoneNumber(module.exports.PAIRING_NUMBER);
  } catch (error) {
    console.error('⚠️ PAIRING_NUMBER format error:', error.message);
  }
}

if (module.exports.OWNER_NUMBER) {
  try {
    module.exports.OWNER_NUMBER = validatePhoneNumber(module.exports.OWNER_NUMBER);
  } catch (error) {
    console.error('⚠️ OWNER_NUMBER format error:', error.message);
  }
}
