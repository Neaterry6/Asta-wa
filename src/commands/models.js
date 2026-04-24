import {
  QWEN_MODELS,
  getCurrentQwenModel,
  setCurrentQwenModel,
  getDefaultQwenModel
} from '../../includes/qwen.js';

export default {
  config: {
    name: 'models',
    aliases: ['model', 'qwen'],
    description: 'List, set, reset, and view current Qwen model',
    usage: ['.models', '.models current', '.models set <name>', '.models reset'],
    category: 'ai'
  },

  onRun: async (sock, message, args) => {
    const action = (args[0] || '').toLowerCase();
    const chat = message.key.remoteJid;

    if (!action || action === 'list') {
      const current = getCurrentQwenModel();
      const msg = `🧠 *Qwen Models*\n\nCurrent: *${current}*\n\n${QWEN_MODELS.map((m, i) => `${i + 1}. ${m}`).join('\n')}`;
      return sock.sendMessage(chat, { text: msg }, { quoted: message });
    }

    if (action === 'current') {
      return sock.sendMessage(chat, { text: `🎯 Current Qwen model: *${getCurrentQwenModel()}*` }, { quoted: message });
    }

    if (action === 'reset') {
      const fallback = getDefaultQwenModel();
      setCurrentQwenModel(fallback);
      return sock.sendMessage(chat, { text: `♻️ Model reset to default: *${fallback}*` }, { quoted: message });
    }

    if (action === 'set') {
      const model = args.slice(1).join(' ').trim();
      if (!model) {
        return sock.sendMessage(chat, { text: 'Usage: .models set <model-name>' }, { quoted: message });
      }
      const found = QWEN_MODELS.find((m) => m.toLowerCase() === model.toLowerCase());
      if (!found) {
        return sock.sendMessage(chat, { text: '❌ Unknown model. Use .models to list supported models.' }, { quoted: message });
      }
      setCurrentQwenModel(found);
      return sock.sendMessage(chat, { text: `✅ Qwen model set to *${found}*` }, { quoted: message });
    }

    return sock.sendMessage(chat, { text: 'Usage: .models | .models current | .models set <name> | .models reset' }, { quoted: message });
  }
};
