import fs from 'fs-extra';
import path from 'path';

const SESSION_DB = path.resolve('cache/session-index.json');

async function readIndex() {
  try {
    return await fs.readJson(SESSION_DB);
  } catch {
    return { sessions: [] };
  }
}

async function writeIndex(data) {
  await fs.ensureDir(path.dirname(SESSION_DB));
  await fs.writeJson(SESSION_DB, data, { spaces: 2 });
}

export default {
  config: {
    name: 'session',
    aliases: ['sessions'],
    description: 'Manage paired sessions (status/labels/label)',
    usage: ['.session status', '.session labels', '.session label <number> <name>'],
    category: 'admin',
    Permission: 1
  },

  onRun: async (_sock, message, args) => {
    const action = (args[0] || 'status').toLowerCase();
    const index = await readIndex();
    index.sessions ||= [];

    if (action === 'status') {
      const lines = index.sessions.map((s) => {
        const isOnline = global.client.activeSessions?.has(s.id);
        return `${isOnline ? '🟢' : '🔴'} ${s.id}${s.label ? ` (${s.label})` : ''}`;
      });
      return message.reply(lines.length ? `📡 *Session Status*\n\n${lines.join('\n')}` : 'No sessions found.');
    }

    if (action === 'labels') {
      const lines = index.sessions.map((s) => `• ${s.id}: ${s.label || '-'}`);
      return message.reply(lines.length ? `🏷️ *Session Labels*\n\n${lines.join('\n')}` : 'No sessions found.');
    }

    if (action === 'label') {
      const number = (args[1] || '').replace(/[^0-9]/g, '');
      const label = args.slice(2).join(' ').trim();
      if (!number || !label) return message.reply('Usage: .session label <number> <name>');

      const session = index.sessions.find((s) => s.id === number);
      if (!session) return message.reply('❌ Session not found. Pair first.');

      session.label = label;
      await writeIndex(index);
      return message.reply(`✅ Label saved: ${number} -> ${label}`);
    }

    return message.reply('Usage: .session status | .session labels | .session label <number> <name>');
  }
};
