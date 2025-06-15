module.exports = {
  pattern: "button",
  alias: ["buttons", "btn"],
  react: "🧷",
  desc: "Send a button message",
  category: "General",
  use: ".button <text>",

  async function(conn, m, sms, { args, from }) {
    const text = args.join(" ");
    if (!text) return conn.sendMessage(from, { text: "❌ Please provide text to display with buttons." }, { quoted: m });

    await conn.sendMessage(from, {
      text: text,
      footer: "Mr Senal Bot 🔘",
      buttons: [
        { buttonId: ".alive", buttonText: { displayText: "✅ Alive" }, type: 1 },
        { buttonId: ".menu", buttonText: { displayText: "📦 Menu" }, type: 1 }
      ],
      headerType: 1
    }, { quoted: m });
  }
};
