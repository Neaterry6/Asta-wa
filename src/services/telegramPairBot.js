import fs from 'fs-extra';
import path from 'path';
import log from '../../includes/log.js';
import { normalizePairNumber } from '../../includes/phone.js';

const TELEGRAM_API = 'https://api.telegram.org';
const STORE_FILE = path.join(process.cwd(), 'data', 'telegram-pairs.json');

function resolveTelegramToken() {
  const raw = String(
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_TOKEN ||
    process.env.TG_BOT_TOKEN ||
    ''
  ).trim().replace(/^['"]|['"]$/g, '');

  const botId = String(process.env.TELEGRAM_BOT_ID || process.env.TELEGRAM_ID || '').trim().replace(/^bot/i, '').replace(/:$/, '');

  if (!raw && !botId) return '';
  if (/^\d+:[A-Za-z0-9_-]{20,}$/.test(raw)) return raw;

  const secret = raw.replace(/^bot(?=\d+:)/i, '').replace(/^\d+:/, '').replace(/^:/, '');
  return botId && secret ? `${botId}:${secret}` : raw;
}

async function tgCall(token, method, payload = {}) {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

async function loadStore() {
  try {
    const data = await fs.readJSON(STORE_FILE);
    return data && typeof data === 'object' ? data : { pairs: [] };
  } catch {
    return { pairs: [] };
  }
}

async function saveStore(store) {
  await fs.ensureDir(path.dirname(STORE_FILE));
  await fs.writeJSON(STORE_FILE, store, { spaces: 2 });
}

function normalizeNumber(input = '') {
  return normalizePairNumber(input) || String(input).replace(/\D/g, '');
}

export async function startTelegramPairBot({ createPairSession } = {}) {
  const token = resolveTelegramToken();
  if (!token) {
    log.info('Telegram pair bot disabled (missing TELEGRAM_BOT_TOKEN).');
    return null;
  }

  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
    log.warn('Telegram pair bot disabled (invalid token format).');
    return null;
  }

  if (typeof createPairSession !== 'function') {
    log.warn('Telegram pair bot disabled (createPairSession callback missing).');
    return null;
  }

  let running = true;
  let offset = 0;

  try {
    await tgCall(token, 'getMe');
    await tgCall(token, 'setMyCommands', {
      commands: [
        { command: 'start', description: 'Show menu' },
        { command: 'pair', description: 'Generate WhatsApp pair code' },
        { command: 'pairs', description: 'Show my recent pair records' },
        { command: 'delpair', description: 'Delete a pair record by id' },
        { command: 'ping', description: 'Check bot latency' }
      ]
    }).catch(() => {});
    log.success('Telegram pair bot started.');
  } catch (error) {
    log.warn(`Telegram pair bot disabled: ${error.message}`);
    return null;
  }

  const sendText = (chatId, text) => tgCall(token, 'sendMessage', { chat_id: chatId, text });

  async function handlePair(chatId, user, text) {
    const number = normalizeNumber(text.replace(/^\/?pair(@\w+)?/i, '').trim());
    if (!number) return sendText(chatId, '❌ Usage: /pair <number with country code>');

    const pairId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      await sendText(chatId, `⏳ Generating pair code for +${number}...`);
      const authDir = path.resolve('cache/sessions', number);
      const code = await createPairSession(number, authDir, number);
      const formatted = code?.match(/.{1,4}/g)?.join('-') || code;

      const store = await loadStore();
      store.pairs ||= [];
      store.pairs.push({
        id: pairId,
        tgUserId: String(user.id),
        tgUsername: user.username || user.first_name || 'unknown',
        number,
        code: formatted,
        createdAt: new Date().toISOString(),
        status: 'code_sent'
      });
      await saveStore(store);

      return sendText(chatId, `🔐 Pair code for +${number}:\n${formatted}\n\nOpen WhatsApp > Linked Devices > Link with phone number.`);
    } catch (error) {
      return sendText(chatId, `❌ Pair failed: ${error.message}`);
    }
  }

  async function handlePairs(chatId, user) {
    const store = await loadStore();
    const mine = (store.pairs || []).filter((x) => x.tgUserId === String(user.id)).slice(-15).reverse();
    if (!mine.length) return sendText(chatId, 'ℹ️ You have no pair records yet.');
    return sendText(chatId, `📄 Your pair records:\n\n${mine.map((x, i) => `${i + 1}. ${x.number} • ${x.status} • id:${x.id}`).join('\n')}`);
  }

  async function handleDelPair(chatId, user, text) {
    const id = text.replace(/^\/?delpair(@\w+)?/i, '').trim();
    const store = await loadStore();
    const before = store.pairs?.length || 0;
    store.pairs = (store.pairs || []).filter((x) => x.tgUserId !== String(user.id) || (id && x.id !== id));
    await saveStore(store);
    const removed = before - (store.pairs?.length || 0);
    return sendText(chatId, removed > 0 ? `✅ Removed ${removed} record(s).` : 'ℹ️ No matching record found.');
  }

  async function handleUpdate(update) {
    const msg = update?.message;
    const text = msg?.text || '';
    const chatId = msg?.chat?.id;
    const user = msg?.from;
    if (!chatId || !user || !text) return;

    if (/^\/start|^\/menu/i.test(text)) {
      return sendText(chatId, [
        '🤖 Telegram Pair Bot',
        '',
        '/pair <number> - generate WhatsApp pair code',
        '/pairs - list your recent pair records',
        '/delpair <id> - delete one pair record',
        '/ping - health check'
      ].join('\n'));
    }
    if (/^\/pair\b/i.test(text)) return handlePair(chatId, user, text);
    if (/^\/pairs\b/i.test(text)) return handlePairs(chatId, user);
    if (/^\/delpair\b/i.test(text)) return handleDelPair(chatId, user, text);
    if (/^\/ping\b/i.test(text)) return sendText(chatId, '🏓 Pong!');
  }

  (async function loop() {
    while (running) {
      try {
        const updates = await tgCall(token, 'getUpdates', {
          offset,
          timeout: 25,
          allowed_updates: ['message']
        });

        for (const update of updates) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }
      } catch (error) {
        log.warn(`Telegram polling error: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  })().catch((error) => log.error('Telegram pair loop crashed:', error));

  return {
    stop() {
      running = false;
    }
  };
}
