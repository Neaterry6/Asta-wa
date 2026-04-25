import axios from 'axios';
import { getHistory, addToHistory } from '../../includes/aiMemory.js';
import { setReplyCallback } from '../../handler/replyHandler.js';
import { getCurrentQwenModel, getQwenConfig } from '../../includes/qwen.js';

const SYSTEM_PROMPT = `you are asta bot created by asta ichiyukimori you'll you will act and reply like you're a boss`;

function toOpenAiMessages(history) {
  return history.map((h) => ({
    role: h.role === 'model' ? 'assistant' : h.role,
    content: h.parts?.map((p) => p.text).join(' ') || h.content || ''
  }));
}

async function qwenChat(messages) {
  const qwen = getQwenConfig();
  if (!qwen.apiKey) return null;

  const res = await axios.post(
    `${qwen.baseUrl}/v1/chat/completions`,
    {
      model: getCurrentQwenModel(),
      messages
    },
    {
      headers: {
        Authorization: `Bearer ${qwen.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    }
  );

  return res.data?.choices?.[0]?.message?.content?.trim() || null;
}

export default {
  config: {
    name: 'asta',
    aliases: ['asta-kun', 'astabot', 'asta-bot', 'terry'],
    description: 'Chat with Terry AI (Qwen token)',
    usage: ['.asta <message>', '.asta help'],
    category: 'ai'
  },

  onRun: async (sock, message, args) => {
    const jid = message.key.participantAlt || message.key.participant || message.key.remoteJid;

    if (!args.length || args[0].toLowerCase() === 'help') {
      return message.reply(
        `🤖 *Terry AI Help*\n\n` +
          `• .asta <text> → chat with Terry\n` +
          `• .models → list Qwen models\n` +
          `• .models set <name> → switch model\n` +
          `• .models current → show selected model\n\n` +
          `Flow: Qwen token only. Set QWEN_API_KEY to enable replies.`
      );
    }

    const userText = args.join(' ');

    try {
      addToHistory(jid, 'user', userText);
      const openAiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...toOpenAiMessages(getHistory(jid))
      ];

      let aiText = await qwenChat(openAiMessages);

      if (!aiText) {
        aiText = '⚠️ Qwen is not configured. Add QWEN_API_KEY to enable replies.';
      }

      addToHistory(jid, 'model', aiText);

      const sent = await sock.sendMessage(message.key.remoteJid, { text: aiText.slice(0, 4000) }, { quoted: message });

      setReplyCallback(sent.key.id, jid, async (sock2, replyMsg) => {
        const text = replyMsg.message?.conversation || replyMsg.message?.extendedTextMessage?.text;
        if (!text) return;

        addToHistory(jid, 'user', text);

        const history = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...toOpenAiMessages(getHistory(jid))
        ];

        let replyText = await qwenChat(history);
        if (!replyText) replyText = '⚠️ Qwen is not configured. Add QWEN_API_KEY to enable replies.';

        addToHistory(jid, 'model', replyText);
        await replyMsg.reply(replyText.slice(0, 4000));
      });
    } catch (err) {
      console.error('AI error:', err);
      await message.reply('❌ AI error. Try again later.');
    }
  }
};
