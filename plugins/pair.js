const { cmd } = require("../command");
const mongoose = require("mongoose");
const crypto = require("crypto");

// ===== MongoDB Pairing Schema =====
const pairSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true }
});
const Pair = mongoose.model("Pair", pairSchema);

// ===== Generate a pairing code =====
async function createPair(phoneNumber) {
  const code = crypto.randomBytes(3).toString("hex"); // e.g., 1a2b3c
  const expiresAt = new Date(Date.now() + 60 * 1000); // expires in 1 min

  await Pair.findOneAndUpdate(
    { phoneNumber },
    { code, expiresAt },
    { upsert: true, new: true }
  );

  return code;
}

// ===== Check if number is paired =====
async function isPaired(phoneNumber) {
  const pair = await Pair.findOne({ phoneNumber });
  if (!pair) return false;
  if (new Date() > pair.expiresAt) {
    await Pair.deleteOne({ phoneNumber });
    return false;
  }
  return true;
}

// ===== Pair Command =====
cmd({
  pattern: "pair",
  alias: ["getpair", "freebot"],
  react: "✅",
  desc: "Get pairing code for Senal MD bot",
  category: "download",
  use: ".pair 9474XXXXXXX",
  filename: __filename
}, async (conn, mek, m, { q, senderNumber, reply, from }) => {
  try {
    const phoneNumber = q
      ? q.trim().replace(/[^0-9]/g, "")
      : senderNumber.replace(/[^0-9]/g, "");

    if (!phoneNumber || phoneNumber.length < 10 || phoneNumber.length > 15) {
      return await reply("❌ Invalid number. Example: `.pair 94741234567`");
    }

    const code = await createPair(phoneNumber);

    await reply(
      `✅ Pairing code generated!\n\n` +
      `Your code: \`${code}\`\n` +
      `It will expire in 1 minute. Use immediately!`
    );

  } catch (err) {
    console.error("Pair command error:", err);
    await reply("❌ Failed to generate pairing code.");
  }
});

// ===== Middleware to check pairing before commands =====
cmd({
  pattern: "checkpair",
  desc: "Check if your number is paired",
  category: "download",
  filename: __filename
}, async (conn, mek, m, { senderNumber, reply }) => {
  const paired = await isPaired(senderNumber);
  if (paired) return await reply("✅ You are paired! You can use commands.");
  await reply("❌ You are not paired. Use `.pair <number>` to get a code.");
});

// ===== Example Command requiring pairing =====
cmd({
  pattern: "menu",
  desc: "Show menu (requires pairing)",
  category: "main",
  filename: __filename
}, async (conn, mek, m, { senderNumber, reply }) => {
  const paired = await isPaired(senderNumber);
  if (!paired) return await reply("❌ You must pair first. Use `.pair <number>`");

  await reply(
    `📝 Welcome to Senal MD Bot\n` +
    `Developer: Mr Senal\n` +
    `Logo: https://files.catbox.moe/gm88nn.png\n` +
    `Prefix: .\n\n` +
    `Use commands like .moviedl, .tvshowdl etc.`
  );
});
