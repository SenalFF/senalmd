const axios = require("axios");
const { cmd } = require("../command");

cmd({
    pattern: "app",
    alias: ["apkd", "apks"],
    desc: "📱 Senal MD ⚡ | Download APKs by Package ID",
    react: "📱",
    category: "download",
    filename: __filename,
},
async (conn, mek, m, { from, reply, args }) => {
    try {
        const query = args[0];
        if (!query) {
            return reply("⚡ Senal MD: Please provide an APK package ID!\n👉 Example: .apk com.dts.freefireth");
        }

        const { data } = await axios.get(`https://www.dark-yasiya-api.site/download/apk?id=${encodeURIComponent(query)}`);

        if (!data.status || !data.result) {
            return reply("⚡ Senal MD: APK not found. Please check the package ID and try again.");
        }

        const apk = data.result;

        // Info message
        let apkInfo = `📱 *Senal MD ⚡ APK Downloader* 📱\n\n`;
        apkInfo += `📌 *Name:* ${apk.name}\n`;
        apkInfo += `📦 *Package:* ${apk.package}\n`;
        apkInfo += `📏 *Size:* ${apk.size}\n`;
        apkInfo += `📝 *Version:* ${apk.version}\n`;

        // Send app info with icon
        await conn.sendMessage(from, {
            image: { url: apk.icon },
            caption: apkInfo
        }, { quoted: m });

        // Send the actual APK file
        await conn.sendMessage(from, {
            document: { url: apk.dl_link },
            mimetype: "application/vnd.android.package-archive",
            fileName: `${apk.name || "app"}.apk`
        }, { quoted: m });

    } catch (error) {
        console.error("Error in APK command:", error);
        reply("⚡ Senal MD: Sorry, something went wrong while fetching the APK. Please try again later.");
    }
});
