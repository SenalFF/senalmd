// upload.js
const axios = require("axios");
const FormData = require("form-data");

async function uploadToGofile(buffer, filename) {
  try {
    console.log("🚀 Getting best Gofile server...");
    const serverRes = await axios.get("https://api.gofile.io/getServer");
    const server = serverRes.data.data.server;

    console.log("📤 Uploading file to Gofile...");
    const form = new FormData();
    form.append("file", buffer, filename);

    const uploadRes = await axios.post(`https://${server}.gofile.io/uploadFile`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const { directLink } = uploadRes.data.data;

    console.log("✅ Gofile Upload Success:", directLink);
    return { success: true, directUrl: directLink };
  } catch (err) {
    console.error("❌ Gofile Upload Error:", err.message);
    return { success: false, error: err.message };
  }
}

module.exports = uploadToGofile
