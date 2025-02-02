const { cmd } = require('../command');
const axios = require('axios');
const mime = require('mime-types');

// Your Google Drive API Key
const API_KEY = "AIzaSyB7OnWWJpaxzG70ko0aWXKgzjBpb4KZR98";

cmd({
    pattern: "gdrive",
    desc: "Download and send files from Google Drive using API",
    category: "download",
    react: "📂",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❌ Please provide a valid Google Drive link.");

        // Extract File ID
        const match = q.match(/(?:drive\.google\.com\/file\/d\/|id=)([\w-]+)/);
        if (!match) {
            return reply("❌ Invalid Google Drive link. Please provide a correct URL.");
        }
        const fileId = match[1];

        // Fetch file metadata
        const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size&key=${API_KEY}`;
        const metadataResponse = await axios.get(metadataUrl);
        const { name: fileName, mimeType, size } = metadataResponse.data;

        console.log("[GDRIVE COMMAND] File Metadata:", { fileName, mimeType, size });

        const fileSizeMB = size ? (parseInt(size, 10) / (1024 * 1024)).toFixed(2) : 'Unknown';

        // Construct download URL (this is a direct media access URL)
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`;
        console.log("[GDRIVE COMMAND] Download URL:", downloadUrl);

        // If file is larger than 100 MB, provide a download link instead of sending via WhatsApp
        if (size && parseInt(size, 10) > 100 * 1024 * 1024) {
            // Provide a download link
            return reply(`❌ The file size is too large to send via WhatsApp.\n\n📄 *Name:* ${fileName}\n📦 *Size:* ${fileSizeMB} MB\n\n👉 [Download File](${downloadUrl})`);
        }

        // Directly stream the file using Axios
        const fileStream = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream'
        });

        // Send the file as a document without downloading it locally
        await conn.sendMessage(from, {
            document: fileStream.data,
            mimetype: mimeType || "application/octet-stream",
            fileName: fileName || "downloaded_file",
            caption: `📂 *File from Google Drive*\n\n📄 *Name:* ${fileName}\n📦 *Size:* ${fileSizeMB} MB`
        }, { quoted: mek });

    } catch (error) {
        console.error("[GDRIVE COMMAND] Error:", error);
        reply(`❌ An error occurred while processing your request.\n\n*Error Details:* ${error.message}`);
    }
});
