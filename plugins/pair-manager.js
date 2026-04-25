import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizePairNumber } from '../includes/phone.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.resolve(__dirname, '../cache/sessions');
const SESSION_DB = path.resolve(__dirname, '../cache/session-index.json');

async function readIndex() {
  try {
    return await fs.readJson(SESSION_DB);
  } catch {
    return { sessions: [] };
  }
}

async function writeIndex(index) {
  await fs.ensureDir(path.dirname(SESSION_DB));
  await fs.writeJson(SESSION_DB, index, { spaces: 2 });
}


export default {
  name: 'pair-manager',

  async onMessage(sock, message, ctx) {
    const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const lowered = text.toLowerCase();

    if (!lowered.startsWith('.pair')) return;

    const args = text.split(/\s+/).slice(1);
    const mode = (args[0] || '').toLowerCase();

    // Let command handlers own the actual `.pair <number>` and `.multipair` flows.
    // This plugin only handles management actions.
    const managementModes = new Set(['help', 'list', 'remove', 'rm']);
    if (!managementModes.has(mode)) return true;

    if (mode === 'help') {
      await sock.sendMessage(ctx.chat, {
        text: [
          '🔗 *Pair Manager*',
          '',
          '`.pair <number>` → create one session and show code (command)',
          '`.multipair <n1> <n2> ...` → pair many numbers (command)',
          '`.pair list` → show saved sessions (plugin)',
          '`.pair remove <number>` → delete session auth/index (plugin)'
        ].join('\n')
      }, { quoted: message });
      return false;
    }

    if (mode === 'list') {
      const index = await readIndex();
      const sessions = index.sessions || [];
      await sock.sendMessage(ctx.chat, {
        text: sessions.length
          ? `📂 *Saved sessions*\n\n${sessions.map(s => `• ${s.id} → ${s.authDir}`).join('\n')}`
          : '📂 No saved sessions yet.'
      }, { quoted: message });
      return false;
    }

    if (mode === 'remove' || mode === 'rm') {
      const num = normalizePairNumber(args[1]);
      if (!num) {
        await sock.sendMessage(ctx.chat, { text: '⚠️ provide a number to remove' }, { quoted: message });
        return false;
      }

      const index = await readIndex();
      index.sessions = (index.sessions || []).filter(s => s.id !== num);
      await writeIndex(index);
      await fs.remove(path.join(SESSIONS_DIR, num));
      await sock.sendMessage(ctx.chat, { text: `🗑️ removed session ${num}` }, { quoted: message });
      return false;
    }

    return true;
  }
};
