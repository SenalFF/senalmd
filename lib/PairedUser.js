const mongoose = require("mongoose");

const pairedUserSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("PairedUser", pairedUserSchema);
