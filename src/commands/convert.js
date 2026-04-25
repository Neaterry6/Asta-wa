import config from '../../config.js';

function getRepliedText(message) {
  const contextInfo = message.message?.extendedTextMessage?.contextInfo;
  const quoted = contextInfo?.quotedMessage;
  if (!quoted) return '';

  return (
    quoted.conversation ||
    quoted.extendedTextMessage?.text ||
    quoted.imageMessage?.caption ||
    quoted.videoMessage?.caption ||
    ''
  ).trim();
}

function normalizeCommandBody(text = '') {
  const line = String(text).split(/\n+/)[0].trim();
  if (!line) return '';
  return line.replace(/^[./!#,$]+/, '').trim();
}

export default {
  config: {
    name: 'convert',
    aliases: ['tocmd', 'conv'],
    description: 'Convert a replied command/text to your bot command format',
    usage: ['.convert (reply to message)'],
    category: 'admin',
    Permission: 1
  },

  onRun: async (_sock, message) => {
    const repliedText = getRepliedText(message);
    if (!repliedText) {
      return message.reply('Reply to a message that contains a command/text to convert.');
    }

    const body = normalizeCommandBody(repliedText);
    if (!body) return message.reply('❌ Could not find a valid command text in the replied message.');

    const prefix = config.bot?.prefix || '.';
    return message.reply(`✅ Converted command:\n\n${prefix}${body}`);
  }
};
