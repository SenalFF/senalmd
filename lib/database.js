// lib/database.js
const mongoose = require("mongoose");
const config = require("../config");

async function connectDB() {
    try {
        await mongoose.connect(config.MONGODB_URI); // options removed
        console.log("✅ MongoDB Connected Successfully");
    } catch (err) {
        console.error("❌ MongoDB Connection Failed:", err.message);
        process.exit(1);
    }
}

module.exports = connectDB;
