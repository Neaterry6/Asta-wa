import path from 'path';
import { normalizePairNumber } from '../../includes/phone.js';

function cleanList(args) {
  const tokens = args
    .join(' ')
    .split(/[\s,]+/)
    .map((n) => n.trim())
    .filter(Boolean);

  return tokens
    .map((token) => normalizePairNumber(token) || token.replace(/[^0-9]/g, ''))
    .filter(Boolean);
}

export default {
  config: {
    name: 'multipair',
    aliases: ['mpair'],
    description: 'Create pairing codes for multiple numbers',
    usage: ['.multipair <num1> <num2>', '.multipair <num1,num2,num3>'],
    category: 'admin',
    Permission: 1
  },

  onRun: async (_sock, message, args) => {
    const numbers = cleanList(args);
    if (!numbers.length) return message.reply('Usage: .multipair <num1> <num2> ...');

    if (numbers.length > 10) return message.reply('❌ Max 10 numbers per run.');

    await message.reply(`⏳ Creating codes for ${numbers.length} number(s)...`);

    const lines = [];
    for (const number of numbers) {
      try {
        const authDir = path.resolve('cache/sessions', number);
        const code = await global.client.createPairSession(number, authDir, number);
        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
        lines.push(`✅ ${number} -> ${formatted}`);
      } catch (err) {
        lines.push(`❌ ${number} -> ${err.message}`);
      }
    }

    await message.reply(`🔗 *Multi Pair Result*\n\n${lines.join('\n')}`);
  }
};
