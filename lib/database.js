// lib/database.js
const mongoose = require("mongoose");
const config = require("../config");

async function connectDB() {
    try {
        await mongoose.connect(config.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("✅ MongoDB Connected Successfully");
    } catch (err) {
        console.error("❌ MongoDB Connection Failed:", err.message);
        process.exit(1);
    }
}

// ==================== PAIRED USER SCHEMA ====================
const PairedUserSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true },
    pairedAt: { type: Date, default: Date.now }
});

const PairedUser = mongoose.model("PairedUser", PairedUserSchema);

module.exports = { connectDB, PairedUser };
