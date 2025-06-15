const { cmd } = require('../command');
const { sendMainMenu } = require('../lib/bmsg');

cmd(
  {
    pattern: 'bmenu',
    react: '📁',
    desc: 'Shows main button menu with categories',
    category: 'menu',
    filename: __filename,
  },
  async (conn, mek, m, { from }) => {
    await sendMainMenu(conn, from, mek);
  }
);
