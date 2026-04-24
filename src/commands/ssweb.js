import axios from 'axios';

export default {
  config: {
    name: 'ssweb',
    aliases: ['screenshot', 'webss'],
    description: 'Take full-page screenshot of a website',
    usage: ['.ssweb <url>'],
    category: 'utility'
  },

  onRun: async (sock, message, args) => {
    let url = args[0];
    if (!url) return message.reply('Usage: .ssweb <url>');
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;

    try {
      await message.reply(`🕵️ Taking full-page screenshot of:\n${url}`);

      const apiUrl =
        `https://api.screenshotone.com/take?access_key=KN3bMn5VoWZIWw` +
        `&url=${encodeURIComponent(url)}` +
        `&format=jpg&full_page=true&block_ads=true&block_cookie_banners=true` +
        `&block_trackers=true&image_quality=80&response_type=by_format`;

      const response = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 60000 });
      const imageBuffer = Buffer.from(response.data);

      await sock.sendMessage(message.key.remoteJid, {
        image: imageBuffer,
        mimetype: 'image/jpeg',
        caption: `🖼️ Full-page screenshot of:\n${url}`
      }, { quoted: message });
    } catch (err) {
      console.error('ssweb error:', err.response?.data || err.message);
      await message.reply(`❌ Failed to capture screenshot.\n\n${err.response?.data?.message || err.message}`);
    }
  }
};
