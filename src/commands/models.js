import fs from 'fs';
import path from 'path';
import config from '../../config.js';

const QWEN_MODELS = [
  'Qwen3.6-Plus',
  'Qwen3.5-Plus',
  'Qwen3.5-Flash',
  'Qwen3.5-397B-A17B',
  'Qwen3.5-122B-A10B',
  'Qwen3.5-35B-A3B',
  'Qwen3.5-27B',
  'Qwen3-Max',
  'Qwen3-Coder',
  'Qwen3-Coder-Flash',
  'Qwen3-235B-A22B-2507',
  'Qwen3-30B-A3B-2507',
  'Qwen3-Omni-Flash',
  'Qwen3-VL-235B-A22B',
  'Qwen3-VL-32B',
  'Qwen3-VL-30B-A3B',
  'Qwen3-Next-80B-A3B',
  'Qwen2.5-Max',
  'Qwen2.5-Plus',
  'Qwen2.5-Turbo',
  'Qwen2.5-Coder-32B-Instruct',
  'Qwen2.5-VL-32B-Instruct',
  'Qwen2.5-Omni-7B',
  'Qwen-Deep-Research',
  'Qwen-Web-Dev',
  'Qwen-Full-Stack',
  'Qwen-Slides'
];

const MODEL_FILE = path.resolve('data/qwen-model.json');

function readCurrent() {
  try {
    return JSON.parse(fs.readFileSync(MODEL_FILE, 'utf-8')).model;
  } catch {
    return config.qwen?.defaultModel || 'Qwen3.6-Plus';
  }
}

function writeCurrent(model) {
  fs.mkdirSync(path.dirname(MODEL_FILE), { recursive: true });
  fs.writeFileSync(MODEL_FILE, JSON.stringify({ model }, null, 2));
}

export default {
  config: {
    name: 'models',
    aliases: ['model', 'qwen'],
    description: 'List and set Qwen models',
    usage: ['.models', '.models set <name>'],
    category: 'ai'
  },

  onRun: async (sock, message, args) => {
    const action = (args[0] || '').toLowerCase();

    if (!action) {
      const current = readCurrent();
      const msg = `🧠 *Qwen Models*\n\nCurrent: *${current}*\n\n${QWEN_MODELS.map((m, i) => `${i + 1}. ${m}`).join('\n')}`;
      return sock.sendMessage(message.key.remoteJid, { text: msg }, { quoted: message });
    }

    if (action === 'set') {
      const model = args.slice(1).join(' ').trim();
      if (!model) {
        return sock.sendMessage(message.key.remoteJid, { text: 'Usage: .models set <model-name>' }, { quoted: message });
      }
      const found = QWEN_MODELS.find(m => m.toLowerCase() === model.toLowerCase());
      if (!found) {
        return sock.sendMessage(message.key.remoteJid, { text: `❌ Unknown model. Use .models to list them.` }, { quoted: message });
      }
      writeCurrent(found);
      return sock.sendMessage(message.key.remoteJid, { text: `✅ Qwen model set to *${found}*` }, { quoted: message });
    }

    return sock.sendMessage(message.key.remoteJid, { text: 'Usage: .models | .models set <name>' }, { quoted: message });
  }
};
