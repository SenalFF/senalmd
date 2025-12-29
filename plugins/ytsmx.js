const { cmd } = require('../command');

cmd({
  pattern: "movie",
  react: "🎬",
  category: "test",
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {

  await conn.sendMessage(from, {
    text: "Select a movie",
    buttons: [
      { buttonId: "movie_select_0", buttonText: { displayText: "🎬 Avatar" }, type: 1 },
      { buttonId: "movie_select_1", buttonText: { displayText: "🎬 Batman" }, type: 1 }
    ],
    footer: "Movie Test",
    headerType: 1
  }, { quoted: mek });
});

/* ✅ BUTTON HANDLER */
cmd({
  buttonHandler: async (conn, mek, btnId) => {
    const from = mek.key.remoteJid;

    // 🔥 DEBUG (VERY IMPORTANT)
    console.log("BUTTON CLICKED:", btnId);

    if (btnId === "movie_select_0") {
      return conn.sendMessage(from, { text: "✅ Avatar selected" }, { quoted: mek });
    }

    if (btnId === "movie_select_1") {
      return conn.sendMessage(from, { text: "✅ Batman selected" }, { quoted: mek });
    }
  }
});
