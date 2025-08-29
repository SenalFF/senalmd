const { cmd } = require("../command");
const nima = require("mrnima-moviedl");
const axios = require("axios");

const sessions = {};

async function downloadFile(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

async function sendDocument(robin, from, mek, buffer, title) {
  await robin.sendMessage(
    from,
    {
      document: buffer,
      mimetype: "video/mp4",
      fileName: `${title.slice(0, 30)}.mp4`,
      caption: "✅ *Movie sent by SENAL MD* 🎥",
    },
    { quoted: mek }
  );
}

// ▶️ .moviedl command
cmd(
  {
    pattern: "moviedl",
    desc: "📥 Search & Download Movies",
    category: "download",
    react: "🎬",
  },
  async (robin, mek, m, { q, reply }) => {
    const from = mek.key.remoteJid;
    if (!q) return reply("🎬 *Please enter a movie name.*");

    try {
      await reply("🔎 Searching for your movie...");
      const res = await nima(q).catch(() => null);

      if (!res || res.length === 0) return reply("❌ *Movie not found!*");

      const movie = res[0];
      if (!movie.download_links) return reply("⚠️ *No download links available!*");

      sessions[from] = {
        movie,
        step: "choose_quality",
      };

      let info = `
🎬 *SENAL MD Movie Downloader*

🎞️ *Title:* ${movie.title}
📅 *Year:* ${movie.year}

📥 *Available Qualities:*
${Object.keys(movie.download_links).map((q, i) => `🔹 *movie${i+1}* - ${q}`).join("\n")}

✍️ _Reply with the command shown above (ex: *movie1*)_
`;

      await robin.sendMessage(
        from,
        {
          image: { url: movie.poster },
          caption: info,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("MovieDL Error:", err);
      reply("❌ *Error while searching movie.*");
    }
  }
);

// Dynamic handlers for movie qualities
Object.keys(new Array(5)).forEach((_, idx) => {
  const cmdName = `movie${idx+1}`;
  cmd(
    {
      pattern: cmdName,
      desc: "Send selected movie",
      dontAddCommandList: true,
    },
    async (robin, mek, m, { reply }) => {
      const from = mek.key.remoteJid;
      const session = sessions[from];
      if (!session || session.step !== "choose_quality") return;

      try {
        const movie = session.movie;
        const qualities = Object.keys(movie.download_links);
        if (!qualities[idx]) return reply("⚠️ Invalid selection.");

        const selected = qualities[idx];
        await reply(`⏬ Fetching download for *${movie.title}* (${selected})...`);

        const url = movie.download_links[selected];
        const buffer = await downloadFile(url);

        await sendDocument(robin, from, mek, buffer, movie.title);

        await reply("✅ *Movie sent successfully!*");
      } catch (err) {
        console.error("Movie Send Error:", err);
        reply("❌ *Failed to send movie.*");
      }

      delete sessions[from];
    }
  );
});
