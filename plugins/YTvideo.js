const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

cmd(
  {
    pattern: "video",
    react: "🎥",
    desc: "Download YouTube Video",
    category: "download",
    filename: __filename,
  },
  async (
    robin,
    mek,
    m,
    { from, quoted, body, isCmd, command, args, q, isGroup, sender, reply }
  ) => {
    try {
      if (!q) return reply("*🛑 Please provide a YouTube video name or URL.*");

      // Search for the video
      const search = await yts(q);
      const data = search.videos[0];
      const url = data.url;

      // Metadata caption
      let desc = `🎥 *SENAL MD YOUTUBE DOWNLOADER* 🎥

🔹 *Title*     : ${data.title}
⏱️ *Duration*  : ${data.timestamp}
👁️ *Views*     : ${data.views}
📤 *Uploaded*  : ${data.ago}
👤 *Channel*   : ${data.author.name}
🔗 *Video URL* : ${data.url}

✨ 𝑷𝒐𝒘𝒆𝒓𝒆𝒅 𝒃𝒚 *SENAL MD BOT* ✨`;

      // Send metadata and thumbnail
      await robin.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      // Video download function
      const downloadVideo = async (url, quality) => {
        const apiUrl = `https://p.oceansaver.in/ajax/download.php?format=${quality}&url=${encodeURIComponent(
          url
        )}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`;

        const response = await axios.get(apiUrl);

        if (response.data && response.data.success) {
          const { id, title } = response.data;

          const progressUrl = `https://p.oceansaver.in/ajax/progress.php?id=${id}`;

          while (true) {
            const progress = await axios.get(progressUrl);

            if (
              progress.data.success &&
              progress.data.progress === 1000 &&
              progress.data.download_url
            ) {
              const videoBuffer = await axios.get(progress.data.download_url, {
                responseType: "arraybuffer",
              });

              return { buffer: videoBuffer.data, title };
            }

            // Wait 5 seconds before retrying
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        } else {
          throw new Error("❌ Failed to get download info.");
        }
      };

      const quality = "360";
      const video = await downloadVideo(url, quality);

      await robin.sendMessage(
        from,
        {
          video: video.buffer,
          caption: `🎬 *${video.title}*

✅ 𝑫𝒐𝒘𝒏𝒍𝒐𝒂𝒅 𝑪𝒐𝒎𝒑𝒍𝒆𝒕𝒆! 💾
🌟 𝑷𝒐𝒘𝒆𝒓𝒆𝒅 𝒃𝒚 *SENAL MD* 🤖`,
        },
        { quoted: mek }
      );

      reply("*Thanks for using SENAL MD Bot! 🎥❤️*");
    } catch (e) {
      console.error(e);
      reply(`❌ Error: ${e.message}`);
    }
  }
);
