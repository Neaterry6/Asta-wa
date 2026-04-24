import axios from 'axios';

async function generateSuno({ title, lyrics, tags = '', instrumental = false }) {
  if (!title || !lyrics) throw new Error('Title and lyrics are required');

  const url = `https://omegatech-api.dixonomega.tech/api/ai/sonu?title=${encodeURIComponent(title)}&lyrics=${encodeURIComponent(lyrics)}&tags=${encodeURIComponent(tags)}&instrumental=${instrumental}`;
  const { data } = await axios.get(url, { timeout: 120000 });

  if (!data?.success || !data?.result?.length) throw new Error('No music generated');
  return data.result[0];
}

export default {
  config: {
    name: 'suno',
    aliases: ['songai'],
    description: 'Generate music using Suno API',
    usage: ['.suno <title>|<lyrics>|<tags>|instrumental(true/false)'],
    category: 'ai'
  },

  onRun: async (sock, message, args) => {
    const text = args.join(' ').trim();
    if (!text.includes('|')) {
      return message.reply('💥 Usage:\n.suno <title>|<lyrics>|<tags>|instrumental(true/false)');
    }

    try {
      const [title, lyrics, tags = '', instr = 'false'] = text.split('|').map((s) => s.trim());
      const instrumental = instr.toLowerCase() === 'true';

      await message.reply('🎵 Generating your track...');
      const track = await generateSuno({ title, lyrics, tags, instrumental });

      if (track.image_url) {
        await sock.sendMessage(message.key.remoteJid, {
          image: { url: track.image_url },
          caption: `🎶 *${track.title || title}*`
        }, { quoted: message });
      }

      await sock.sendMessage(message.key.remoteJid, {
        audio: { url: track.audio_url },
        mimetype: 'audio/mpeg',
        fileName: `${(track.title || title).slice(0, 40)}.mp3`,
        ptt: false
      }, { quoted: message });
    } catch (err) {
      await message.reply(`💥 *Suno Error*\n${err.message}`);
    }
  }
};
