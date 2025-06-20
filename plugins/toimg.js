const { cmd } = require("../command");
const { downloadMediaMessage } = require("../lib/msg.js");
const sharp = require("sharp");

cmd(
  {
    pattern: "toimg",
    alias: ["img", "photo"],
    desc: "Convert a sticker to an image",
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
      if (!quoted || quoted.mtype !== "stickerMessage") {
        return reply("🧩 කරුණාකර ස්ටිකර් එකකට reply කරන්න එය රූපයකට පරිවර්තනය කිරීමට.");
      }

      const stickerBuffer = await downloadMediaMessage(quoted, "stickerInput");
      if (!stickerBuffer) return reply("❌ Sticker download failed!");

      // Convert WebP sticker to JPEG using sharp
      const imageBuffer = await sharp(stickerBuffer)
        .jpeg({ quality: 90 })
        .toBuffer();

      await robin.sendMessage(
        from,
        {
          image: imageBuffer,
          caption: "✅ Sticker successfully converted to image!\n\n📸 Made by 𝐒𝐄𝐍𝐀𝐋 𝐌𝐃",
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error("ToIMG Error:", e);
      reply(`❌ Error converting sticker: ${e.message}`);
    }
  }
)
