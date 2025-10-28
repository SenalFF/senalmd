// ====================== SENAL MD BOT CONFIG LOADER ======================

require('dotenv').config();

module.exports = {
  botName: "Senal MD",
  developer: "Mr Senal",
  logo: "https://files.catbox.moe/gm88nn.png",

  sessionId: process.env.SESSION_ID,
  mongodburi: process.env.MONGODB_URI,
  prefix: process.env.PREFIX || ".",
  mode: process.env.MODE || "public",
  ownerNumber: process.env.OWNER_NUMBER || "94769872326",
 
  // MEGA credentials
  megaEmail: process.env.MEGA_EMAIL,
  megaPassword: process.env.MEGA_PASSWORD,
  mega_session_url: process.env.MEGA_SESSION_URL,
  
  // Features
  autoVoice: process.env.AUTO_VOICE === "true",
  antiBadWordsEnabled: process.env.ANTI_BAD_WORDS_ENABLED === "true",
  autoReadStatus: process.env.AUTO_READ_STATUS === "true",
  antiBadWords: (process.env.ANTI_BAD_WORDS || "").split(","),
  antiLink: process.env.ANTILINK === "true",
  alwaysOnline: process.env.ALWAYS_ONLINE === "true",
  autoReadCmd: process.env.AUTO_READ_CMD === "true",
  alwaysTyping: process.env.ALWAYS_TYPING === "true",
  alwaysRecording: process.env.ALWAYS_RECORDING === "true",
  antiBot: process.env.ANTI_BOT === "true",
  antiDelete: process.env.ANTI_DELETE === "true",

  packname: process.env.PACKNAME,
  author: process.env.AUTHOR,

  // APIs
  apiKeys: {
    openWeather: process.env.OPENWEATHER_API_KEY,
    elevenLabs: process.env.ELEVENLABS_API_KEY,
    shodan: process.env.SHODAN_API,
    pexels: process.env.PEXELS_API_KEY,
    omdb: process.env.OMDB_API_KEY,
    pixabay: process.env.PIXABAY_API_KEY,
    zipcodebase: process.env.ZIPCODEBASE_API_KEY,
    google: process.env.GOOGLE_API_KEY,
    googleCx: process.env.GOOGLE_CX,
    pastebin: process.env.PASTEBIN_API_KEY,
  },

  // Messages
  messages: {
    start: process.env.START_MSG,
    aliveImage: process.env.ALIVE_IMG,
    aliveMessage: process.env.ALIVE_MSG,
    menuImage: process.env.MENU_IMG,
    menuMessage: process.env.MENU_MSG,
    menuCmd: process.env.MENU_MS,
  },

  ytdlNoUpdate: process.env.YTDL_NO_UPDATE === "1",
  youtubeDlSkipPythonCheck: process.env.YOUTUBE_DL_SKIP_PYTHON_CHECK === "1",
};
