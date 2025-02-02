const mongoose = require('mongoose');
const config = require('../config');
const EnvVar = require('./mongodbenv');

const defaultEnvVariables = [
    { key: 'ALIVE_IMG', value: 'https://files.catbox.moe/gm88nn.png' },
    { key: 'ALIVE_MSG', value: '*👋😼 ||HEY ${pushname} DEAR I AM ALIVE NOW...😚👋||*\n\n`🪄🛠️MINE WHATSAPP CHANEL ;`\n\n_ https://whatsapp.com/channel/0029Vaxy7LJDDmFTQifSew2v 🤖_\n\n`|| *🪄🛠️BOT OWNER NUMBER ;`\n\nhttps://wa.link/bgbwbp 🤖\n\n || `Powered By SENAL MD || Created By = Senal`},
    { key: 'PREFIX', value: '.' },
    { key: 'AUTO_READ_STATUS', value: 'true' },
    { key: 'MODE', value: 'public' },
];

// MongoDB connection function
const connectDB = async () => {
    try {
        await mongoose.connect(config.MONGODB);
        console.log('🛜 MongoDB Connected ✅');

        // Check and create default environment variables
        for (const envVar of defaultEnvVariables) {
            const existingVar = await EnvVar.findOne({ key: envVar.key });

            if (!existingVar) {
                // Create new environment variable with default value
                await EnvVar.create(envVar);
                console.log(`➕ Created default env var: ${envVar.key}`);
            }
        }

    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
