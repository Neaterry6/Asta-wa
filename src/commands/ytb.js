import axios from 'axios';
import yts from 'yt-search';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { downloadMedia } from '../../plugins/mediaDownloader.js';
import { setReplyCallback } from '../../handler/replyHandler.js';

function senderJid(message) {
  return message.key.participantAlt || message.key.participant || message.key.remoteJid;
}

async function downloadAndSend(sock, chatId, quoted, type, url, title) {
  const format = type === 'audio' ? 'm4a' : 'mp4';
  const apiUrl = `https://meow-dl.onrender.com/yt?url=${encodeURIComponent(url)}&format=${format}${type === 'video' ? '&quality=480' : ''}`;
  const info = await axios.get(apiUrl, { timeout: 30000 });
  if (info.data?.status !== 'ok') throw new Error('download failed');

  const ext = type === 'audio' ? 'm4a' : 'mp4';
  const tmp = path.join(os.tmpdir(), `${Date.now()}.${ext}`);
  const stream = await axios({ url: info.data.downloadLink, method: 'GET', responseType: 'stream' });
  const writer = fs.createWriteStream(tmp);
  stream.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  if (type === 'audio') {
    await sock.sendMessage(chatId, { audio: { url: tmp }, mimetype: 'audio/mpeg', fileName: `${title}.mp3`, ptt: false }, { quoted });
  } else {
    await sock.sendMessage(chatId, { video: { url: tmp }, mimetype: 'video/mp4', fileName: `${title}.mp4`, caption: `📺 ${title}` }, { quoted });
  }
  fs.unlink(tmp, () => {});
}

export default {
  config: {
    name: 'ytb',
    aliases: ['youtube', 'yt', 'y'],
    description: 'Search YouTube and download audio/video',
    usage: ['.ytb -a query', '.ytb -v query', '.ytb <url>'],
    category: 'media'
  },

  onRun: async (sock, message, args) => {
    if (!args.length) {
      return message.reply('Usage: .ytb -a <song/url> | .ytb -v <video/url>');
    }

    let type = 'video';
    if (['-a', 'audio'].includes(args[0].toLowerCase())) {
      type = 'audio';
      args.shift();
    } else if (['-v', 'video'].includes(args[0].toLowerCase())) {
      type = 'video';
      args.shift();
    }

    const query = args.join(' ').trim();
    if (!query) return message.reply('Provide a URL or search term.');

    const isUrl = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(query);
    if (isUrl) {
      await message.reply(`⏳ fetching ${type}...`);
      return downloadAndSend(sock, message.key.remoteJid, message, type, query, 'youtube-download');
    }

    await message.reply(`🔍 searching YouTube for: ${query}`);
    const search = await yts(query);
    const videos = search.videos.slice(0, 5);
    if (!videos.length) return message.reply('No results found.');

    const list = [`🎵 *YouTube ${type === 'audio' ? 'Audio' : 'Video'} Results*`, ''];
    videos.forEach((v, i) => list.push(`${i + 1}. ${v.title} — ${v.timestamp || 'live'} — ${v.author.name}`));
    list.push('', 'Reply with 1-5 to download.');

    const sent = await sock.sendMessage(message.key.remoteJid, { text: list.join('\n') }, { quoted: message });
    setReplyCallback(sent.key.id, senderJid(message), async (sock2, replyMsg) => {
      const text = replyMsg.message?.conversation || replyMsg.message?.extendedTextMessage?.text || '';
      const choice = parseInt(text.trim(), 10);
      if (!choice || choice < 1 || choice > videos.length) return replyMsg.reply('Invalid choice.');
      const selected = videos[choice - 1];
      await replyMsg.reply(`⏳ downloading ${selected.title}...`);
      await downloadAndSend(sock2, replyMsg.key.remoteJid, replyMsg, type, selected.url, selected.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').slice(0, 40));
    });
  }
};
