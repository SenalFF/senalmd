// command.js
const fs = require('fs');
const path = require('path');

let commands = [];

/**
 * cmd(info, func)
 * info: { pattern, alias, desc, category, react, on, filename, dontAddCommandList, fromMe }
 * func: async function(conn, mek, m, ctx) { ... }
 */
function cmd(info, func) {
  const data = {
    pattern: (info.pattern || '').toLowerCase(),
    alias: info.alias || [],
    desc: info.desc || '',
    category: info.category || 'misc',
    react: info.react || '',
    on: info.on || 'command',
    filename: info.filename || 'Not Provided',
    dontAddCommandList: info.dontAddCommandList || false,
    fromMe: info.fromMe || false,
    function: func
  };

  // push only if pattern exists
  if (data.pattern) {
    commands.push(data);
  } else {
    console.warn(`⚠️ Skipped plugin (missing pattern) - file: ${data.filename}`);
  }
  return data;
}

function clearCommands() {
  commands = [];
}

function loadPlugins() {
  const pluginDir = path.join(__dirname, 'plugins');
  if (!fs.existsSync(pluginDir)) {
    console.log('⚠️ No plugins folder found.');
    return;
  }

  // clear previously registered plugins to avoid duplicates on reconnect
  clearCommands();

  const pluginFiles = fs.readdirSync(pluginDir).filter(f => f.endsWith('.js'));
  for (const file of pluginFiles) {
    const fullPath = path.join(pluginDir, file);
    try {
      // clear require cache to ensure the plugin's top-level cmd(...) executes fresh
      delete require.cache[require.resolve(fullPath)];
      require(fullPath);
      console.log(`✅ Loaded Plugin: ${file}`);
    } catch (e) {
      console.error(`❌ Error loading plugin ${file}:`, e);
    }
  }
}

module.exports = { cmd, commands, loadPlugins };
