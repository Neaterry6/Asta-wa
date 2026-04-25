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

async function notifyAdmin(sock, text) {
  const admin = global.client.config?.bot?.admins?.[0];
  if (!admin) return;
  try {
    await sock.sendMessage(admin, { text });
  } catch {}
}

export default {
  name: 'pair-manager',

  async onMessage(sock, message, ctx) {
    const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const lowered = text.toLowerCase();

    if (!lowered.startsWith('.pair') && !lowered.startsWith('.multipair')) return;

    const args = text.split(/\s+/).slice(1);
    const mode = (args[0] || '').toLowerCase();

    if (!mode || mode === 'help') {
      await sock.sendMessage(ctx.chat, {
        text: [
          '🔗 *Pair Manager*',
          '',
          '`.pair <number>` → create one session and show code',
          '`.multipair <n1> <n2> ...` → pair many numbers one after the other',
          '`.pair list` → show saved sessions',
          '`.pair remove <number>` → delete session auth/index'
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

    if (mode === 'remove') {
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

    const numbers = mode === 'multipair'
      ? args.slice(1).map(normalizePairNumber).filter(Boolean)
      : [normalizePairNumber(args[0])].filter(Boolean);

    if (!numbers.length) {
      await sock.sendMessage(ctx.chat, { text: '⚠️ no valid phone number provided' }, { quoted: message });
      return false;
    }

    for (const num of numbers) {
      try {
        await fs.ensureDir(path.join(SESSIONS_DIR, num));
        const code = await sock.requestPairingCode(num);
        const index = await readIndex();
        index.sessions ||= [];
        if (!index.sessions.some(s => s.id === num)) {
          index.sessions.push({ id: num, authDir: path.join(SESSIONS_DIR, num), notifyNumber: num });
          await writeIndex(index);
        }

        await sock.sendMessage(ctx.chat, {
          text: `✅ *Pairing code for ${num}:*\n\`${code}\`\n\nsend that code to the user on WhatsApp linked devices.`
        }, { quoted: message });

        await notifyAdmin(sock, `🔗 pairing created for ${num}`);
      } catch (err) {
        await sock.sendMessage(ctx.chat, {
          text: `❌ failed for ${num}: ${err?.message || 'unknown error'}`
        }, { quoted: message });
      }
    }

    return false;
  }
};
