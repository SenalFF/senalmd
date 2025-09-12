const mongoose = require("mongoose");
const config = require("../config");
const EnvVar = require("./mongodbenv");

// Default environment variables to insert if they don't exist
const defaultEnvVariables = [
  { key: "ALIVE_IMG", value: "https://files.catbox.moe/gm88nn.png" },
  { key: "ALIVE_MSG", value: "Hello 👋 I am Senal MD, made by Mr Senal 🪀" },
  { key: "PREFIX", value: "." },
];

const connectDB = async () => {
  try {
    if (!config.MONGODB_URI) {
      throw new Error(
        "❌ MongoDB URI is missing! Please set MONGODB_URI in your .env file."
      );
    }

    // Connect to MongoDB (no deprecated options)
    await mongoose.connect(config.MONGODB_URI);

    console.log("🛜 MongoDB Connected ✅");

    // Insert default env vars if not exist
    for (const envVar of defaultEnvVariables) {
      const existingVar = await EnvVar.findOne({ key: envVar.key });
      if (!existingVar) {
        await EnvVar.create(envVar);
        console.log(`➕ Created default env var: ${envVar.key}`);
      }
    }
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
