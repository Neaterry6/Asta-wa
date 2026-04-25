import path from 'path';
import { setReplyCallback } from '../../handler/replyHandler.js';
import { normalizePairNumber } from '../../includes/phone.js';

function senderJid(message) {
  return message.key.participantAlt || message.key.participant || message.key.remoteJid;
}

function cleanNumber(text = '') {
  return String(text).replace(/[^0-9]/g, '');
}

export default {
  config: {
    name: 'pair',
    aliases: ['link'],
    description: 'Create one pairing code and link a session',
    usage: ['.pair <number>', '.pair'],
    category: 'admin',
    Permission: 1
  },

  onRun: async (sock, message, args) => {
    const input = args.join(' ');
    let number = normalizePairNumber(input) || cleanNumber(input);
    const chat = message.key.remoteJid;

    if (!number) {
      const sent = await sock.sendMessage(chat, { text: '📱 Reply with number including country code (example: 2349xxxxxxx)' }, { quoted: message });
      return setReplyCallback(sent.key.id, senderJid(message), async (_sock, replyMsg) => {
        const body = replyMsg.message?.conversation || replyMsg.message?.extendedTextMessage?.text || '';
        const num = normalizePairNumber(body) || cleanNumber(body);
        if (!num) return replyMsg.reply('❌ Invalid number.');
        await startPair(replyMsg, num);
      });
    }

    await startPair(message, number);
  }
};

async function startPair(message, number) {
  const authDir = path.resolve('cache/sessions', number);

  try {
    await message.reply(`⏳ Creating pairing code for ${number}...`);
    const code = await global.client.createPairSession(number, authDir, number);
    const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
    await message.reply(`🔐 Pair code for ${number}: *${formatted}*\nUse this code in WhatsApp linked devices.`);
  } catch (error) {
    await message.reply(`❌ Pairing failed for ${number}: ${error.message}`);
  }
}
