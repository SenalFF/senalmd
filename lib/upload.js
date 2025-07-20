// upload.js
const axios = require("axios");
const FormData = require("form-data");

async function getGofileServer() {
  const res = await axios.get("https://api.gofile.io/getServer");
  if (!res.data.success) throw new Error("Failed to get Gofile server.");
  return res.data.data.server;
}

async function uploadToGofile(buffer, filename, reply = console.log) {
  try {
    reply("🌐 Getting best Gofile server...");
    const server = await getGofileServer();

    reply("📤 Preparing upload to Gofile...");

    const form = new FormData();
    form.append("file", buffer, filename);

    reply("⏫ Uploading to Gofile.io...");

    const res = await axios.post(`https://${server}.gofile.io/uploadFile`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    if (!res.data.success) throw new Error("Gofile upload failed");

    const link = res.data.data.downloadPage;
    reply(`✅ *Uploaded to Gofile!*\n🔗 ${link}`);
    return link;
  } catch (err) {
    console.error("Gofile Upload Error:", err.message);
    reply("❌ Gofile upload failed.");
    throw err;
  }
}

module.exports = { uploadToGofile };
