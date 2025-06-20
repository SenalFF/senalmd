const { cmd } = require("../command");
const { Sticker, StickerTypes } = require("wa-sticker-formatter");
const { downloadMediaMessage } = require("../lib/msg.js"); // Make sure this path is correct

cmd(
  {
    pattern: "sticker",
    alias: ["s", "stick"],
    desc: "Convert an image or short video to a sticker",
    category: "utility",
    filename: __filename,
  },
  async (
    robin,
    mek,
    m,
    {
      from,
      quoted,
      reply,
    }
  ) => {
    try {
      // Validate that the quoted message contains image or video
      if (!quoted || (!quoted.imageMessage && !quoted.videoMessage)) {
        return reply("🖼️ කරුණාකර ස්ටිකර් එකකට පරිවර්තනය කරන්න ඕනෙ ෆොටෝවක් හෝ වීඩියෝවක් reply කරන්න.");
      }

      // Download the media content
      const media = await downloadMediaMessage(quoted, "stickerInput");
      if (!media) return reply("❌ Failed to download media!");

      // Generate sticker using wa-sticker-formatter
      const sticker = new Sticker(media, {
        pack: "❤️ Senal MD Pack",
        author: "👑 MR SENAL",
        type: StickerTypes.FULL, // or CROPPED
        quality: 70,
        categories: ["😎", "🔥", "🇱🇰"],
      });

      const stickerBuffer = await sticker.toBuffer();

      // Send sticker
      await robin.sendMessage(from, { sticker: stickerBuffer }, { quoted: mek });
    } catch (e) {
      console.error("Sticker Error:", e);
      reply(`❌ Error while creating sticker: ${e.message || e}`);
    }
  }
)
