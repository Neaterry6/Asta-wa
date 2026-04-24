import fs from 'fs';
import path from 'path';

const CODE_MAX_BYTES = 80 * 1024;
const COMMANDS_ROOT = path.join(process.cwd(), 'src', 'commands');

function safePath(input = '') {
  const clean = String(input).trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.includes('\0') || clean.split('/').includes('..')) return null;
  return clean;
}

export default {
  config: {
    name: 'plugins',
    aliases: ['pluginfile', 'plug'],
    description: 'List and fetch command/plugin files',
    usage: ['.plugins list', '.plugins get <file.js>'],
    category: 'owner',
    Permission: 1
  },

  onRun: async (sock, message, args) => {
    const action = (args[0] || '').toLowerCase();
    const chat = message.key.remoteJid;

    if (!action || action === 'help') {
      return sock.sendMessage(chat, {
        text: '📦 *PLUGINS*\n\n• .plugins list\n• .plugins get ytb.js\n• .plugins get folder/file.js'
      }, { quoted: message });
    }

    if (action === 'list' || action === 'ls') {
      const files = fs.readdirSync(COMMANDS_ROOT).filter((f) => f.endsWith('.js'));
      return sock.sendMessage(chat, { text: `📁 Commands (${files.length})\n\n${files.map((f) => `• ${f}`).join('\n')}` }, { quoted: message });
    }

    if (action !== 'get' && action !== 'fetch') {
      return message.reply('❌ Unknown action. Use .plugins list or .plugins get <file.js>');
    }

    const rel = safePath(args[1]);
    if (!rel) return message.reply('❌ Invalid path. Example: .plugins get ytb.js');

    const target = path.resolve(COMMANDS_ROOT, rel);
    const root = path.resolve(COMMANDS_ROOT) + path.sep;
    if (!target.startsWith(root)) return message.reply('❌ Path escaped commands directory.');
    if (!fs.existsSync(target)) return message.reply(`❌ File not found: ${rel}`);

    const content = fs.readFileSync(target, 'utf8');
    if (Buffer.byteLength(content, 'utf8') > CODE_MAX_BYTES) {
      return message.reply(`❌ File too large (${Buffer.byteLength(content, 'utf8')} bytes).`);
    }

    await sock.sendMessage(chat, {
      document: Buffer.from(content, 'utf8'),
      fileName: path.basename(rel),
      mimetype: 'application/javascript'
    }, { quoted: message });
  }
};
