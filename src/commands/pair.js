import path from 'path';
import { setReplyCallback } from '../../handler/replyHandler.js';

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
    let number = cleanNumber(args.join(' '));
    const chat = message.key.remoteJid;

    if (!number) {
      const sent = await sock.sendMessage(chat, { text: '📱 Reply with number including country code (example: 2349xxxxxxx)' }, { quoted: message });
      return setReplyCallback(sent.key.id, senderJid(message), async (_sock, replyMsg) => {
        const body = replyMsg.message?.conversation || replyMsg.message?.extendedTextMessage?.text || '';
        const num = cleanNumber(body);
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
    await message.reply(`🔐 Pair code for ${number}: *${code}*\nUse this code in WhatsApp linked devices.`);
  } catch (error) {
    await message.reply(`❌ Pairing failed for ${number}: ${error.message}`);
  }
}
