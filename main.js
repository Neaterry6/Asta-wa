import 'dotenv/config';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import figlet from 'figlet';
import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

import config from './config.js';
import log from './includes/log.js';
import { loadPlugins } from './handler/pluginHandler.js';
import { handleMessage } from './handler/messageHandler.js';
import { normalizePairNumber, parsePairNumbers } from './includes/phone.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sock;
const activeSessions = new Map();
const pairSessions = new Map();
const reconnectTimers = new Map();
const pendingMainNotifications = [];
const AUTH_ROOT = path.resolve(__dirname, 'cache', 'sessions');
const SESSION_DB = path.resolve(__dirname, 'cache', 'session-index.json');
const MAIN_SESSION_ID = 'main';

function rlPrompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

async function loadSessionIndex() {
  try {
    return await fs.readJson(SESSION_DB);
  } catch {
    return { sessions: [] };
  }
}

async function saveSessionIndex(index) {
  await fs.ensureDir(path.dirname(SESSION_DB));
  await fs.writeJson(SESSION_DB, index, { spaces: 2 });
}

async function registerSessionMeta(sessionId, authDir, notifyNumber = '') {
  const index = await loadSessionIndex();
  index.sessions ||= [];
  const found = index.sessions.find((s) => s.id === sessionId);
  if (!found) {
    index.sessions.push({ id: sessionId, authDir, notifyNumber, label: '' });
  } else {
    found.authDir = authDir;
    if (notifyNumber) found.notifyNumber = notifyNumber;
  }
  await saveSessionIndex(index);
}

async function notifyAdmins(text) {
  if (!sock) return;
  const admins = config.bot?.admins || [];
  for (const jid of admins) {
    try {
      await sock.sendMessage(jid, { text });
    } catch {}
  }
}

function clearReconnectTimer(sessionId) {
  const timer = reconnectTimers.get(sessionId);
  if (!timer) return;
  clearTimeout(timer);
  reconnectTimers.delete(sessionId);
}

function scheduleReconnect(sessionId, authDir, opts = {}, delay = 3000) {
  if (reconnectTimers.has(sessionId)) return;
  const timer = setTimeout(async () => {
    reconnectTimers.delete(sessionId);
    try {
      await createSocketForSession(sessionId, authDir, opts);
    } catch (error) {
      log.warn(`[${sessionId}] Reconnect failed: ${error.message}`);
      scheduleReconnect(sessionId, authDir, opts, delay);
    }
  }, delay);
  reconnectTimers.set(sessionId, timer);
}

function getMainSocket() {
  return activeSessions.get(MAIN_SESSION_ID) || sock || global.client?.mainSocket || null;
}

async function waitForMainSocketReady(timeoutMs = 15000) {
  const existing = getMainSocket();
  if (existing?.user?.id) return existing;

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId;

    const finish = (socket = null) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      resolve(socket);
    };

    const socket = getMainSocket();
    if (!socket) {
      finish(null);
      return;
    }

    const onUpdate = ({ connection }) => {
      if (connection === 'open') {
        socket.ev.off('connection.update', onUpdate);
        finish(socket);
      }
    };

    socket.ev.on('connection.update', onUpdate);
    timeoutId = setTimeout(() => {
      socket.ev.off('connection.update', onUpdate);
      finish(socket.user?.id ? socket : null);
    }, timeoutMs);
  });
}


function queueMainNotification(number, text, sessionId) {
  pendingMainNotifications.push({ number: cleanNumber(number), text, sessionId, createdAt: Date.now() });
}

async function flushMainNotifications() {
  if (!pendingMainNotifications.length) return;
  const mainSock = await waitForMainSocketReady(5000);
  if (!mainSock) return;

  const queued = pendingMainNotifications.splice(0, pendingMainNotifications.length);
  for (const item of queued) {
    if (!item.number || !item.text) continue;
    try {
      await mainSock.sendMessage(`${item.number}@s.whatsapp.net`, { text: item.text });
      log.info(`[${item.sessionId}] Queued pairing notification delivered to ${item.number}.`);
    } catch (error) {
      log.warn(`[${item.sessionId}] Could not deliver queued notification to ${item.number}: ${error.message}`);
    }
  }
}

async function notifyNumberViaMain(number, text, sessionId) {
  const clean = cleanNumber(number);
  if (!clean) return false;

  const mainSock = await waitForMainSocketReady();
  if (!mainSock) {
    queueMainNotification(clean, text, sessionId);
    log.warn(`[${sessionId}] Main session not connected yet. Notification queued for ${clean}.`);
    return false;
  }

  try {
    await mainSock.sendMessage(`${clean}@s.whatsapp.net`, { text });
    log.info(`[${sessionId}] Pairing notification sent to ${clean}.`);
    return true;
  } catch (error) {
    log.warn(`[${sessionId}] Could not notify ${clean}: ${error.message}`);
    return false;
  }
}

async function createSocketForSession(sessionId, authDir, opts = {}) {
  await fs.ensureDir(authDir);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const socket = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: Browsers.ubuntu(`Asta-${sessionId}`),
    printQRInTerminal: false,
    markOnlineOnConnect: true
  });

  if (opts.pairingOnly) {
    pairSessions.set(sessionId, socket);
  }

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && !opts.pairingOnly) {
      console.log(`\n[${sessionId}] Scan this QR to login:`);
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      clearReconnectTimer(sessionId);
      activeSessions.set(sessionId, socket);
      pairSessions.delete(sessionId);
      log.success(`[${sessionId}] WhatsApp connected`);

      const notifyNumber = cleanNumber(opts.notifyNumber || '');
      if (notifyNumber) {
        try {
          await socket.sendMessage(`${notifyNumber}@s.whatsapp.net`, {
            text: `✅ Session linked successfully for *${notifyNumber}*.`
          });
        } catch (e) {
          log.warn(`[${sessionId}] notify failed: ${e.message}`);
        }
      }

      await notifyAdmins(`✅ Session opened: ${sessionId}${notifyNumber ? ` (${notifyNumber})` : ''}`);
      await flushMainNotifications();

      if (typeof opts.onOpen === 'function') {
        try {
          await opts.onOpen(socket, state);
        } catch (e) {
          log.error(`[${sessionId}] onOpen failed: ${e.message}`);
        }
      }
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      activeSessions.delete(sessionId);
      if (pairSessions.get(sessionId) === socket) pairSessions.delete(sessionId);
      if (code !== DisconnectReason.loggedOut) {
        if (code === 405) {
          log.info(`[${sessionId}] Connection closed with 405 (pairing handshake complete). Waiting before reconnect...`);
          scheduleReconnect(sessionId, authDir, opts, 7000);
          return;
        }
        log.warn(`[${sessionId}] Connection lost (${code || 'unknown'}). Reconnecting...`);
        scheduleReconnect(sessionId, authDir, opts);
      } else {
        clearReconnectTimer(sessionId);
        log.error(`[${sessionId}] Logged out. Remove auth folder and pair again.`);
      }
    }
  });

  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (let mek of messages) {
      try {
        if (!mek?.message) continue;
        if (mek.message.ephemeralMessage) mek.message = mek.message.ephemeralMessage.message;
        const isGroup = mek.key.remoteJid?.endsWith('@g.us');
        const ctx = mek.message?.extendedTextMessage?.contextInfo;
        if (isGroup && ctx?.mentionedJid?.some((j) => j.endsWith('@lid'))) {
          const metadata = await socket.groupMetadata(mek.key.remoteJid);
          const lidMap = {};
          for (const lid of ctx.mentionedJid) {
            if (!lid.endsWith('@lid')) continue;
            const match = metadata.participants.find((p) => p.id === lid);
            if (match?.jid) lidMap[lid] = match.jid;
          }
          ctx.mentionedJid = ctx.mentionedJid.map((j) => lidMap[j] || j);
          const replaceText = (text) => {
            if (!text) return text;
            for (const [lid, jid] of Object.entries(lidMap)) {
              text = text.replace(new RegExp(`@${lid.split('@')[0]}\\b`, 'g'), `@${jid.split('@')[0]}`);
            }
            return text;
          };
          if (mek.message.conversation) mek.message.conversation = replaceText(mek.message.conversation);
          if (mek.message.extendedTextMessage?.text) mek.message.extendedTextMessage.text = replaceText(mek.message.extendedTextMessage.text);
        }
        await handleMessage(socket, mek);
      } catch (err) {
        log.error(`[${sessionId}] Message error:`, err);
      }
    }
  });

  return socket;
}

async function requestPairingCodeWithRetry(number, authDir, notifyNumber, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      let sessionSock = pairSessions.get(number) || activeSessions.get(number);
      if (!sessionSock) {
        sessionSock = await createSocketForSession(number, authDir, {
          notifyNumber,
          pairingOnly: true
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
      const code = await sessionSock.requestPairingCode(number);
      return code;
    } catch (error) {
      lastError = error;
      log.warn(`[${number}] Pairing code attempt ${attempt}/${retries} failed: ${error.message}`);
      pairSessions.delete(number);
      activeSessions.delete(number);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  }

  throw new Error(lastError?.message || 'failed to create pairing code');
}

async function createPairSession(sessionId, authDir, notifyNumber = '') {
  const number = cleanNumber(sessionId);
  if (!number) throw new Error('invalid session id');

  await registerSessionMeta(number, authDir, notifyNumber || number);
  await notifyNumberViaMain(
    notifyNumber || number,
    `⏳ Pairing has started for ${number}. Keep WhatsApp online while we generate your link code.`,
    number
  );

  const code = await requestPairingCodeWithRetry(number, authDir, notifyNumber || number);

  await notifyAdmins(`🔐 Pair code created for ${number}: ${code}`);
  await notifyNumberViaMain(
    notifyNumber || number,
    `🔐 Pairing code generated for ${number}. Use the code shown in the bot/admin console to finish linking.`,
    number
  );

  return code;
}

global.client = {
  commands: new Map(),
  replies: new Map(),
  config,
  botadmin: config.bot?.admins || [],
  prefix: config.bot.prefix,
  pairSessions,
  activeSessions,
  sessionIndexPath: SESSION_DB,
  mainSocket: null,
  registerSession: registerSessionMeta,
  createPairedSession: createSocketForSession,
  createPairSession,
  requestPairCode: async (phoneNumber, sessionId = 'main') => {
    const target = activeSessions.get(sessionId) || sock;
    if (!target?.requestPairingCode) throw new Error(`session ${sessionId} not ready`);
    return target.requestPairingCode(cleanNumber(phoneNumber));
  }
};

async function loadCommands() {
  log.info('Loading commands...');
  const commandsPath = path.join(__dirname, 'src', 'commands');

  if (!fs.existsSync(commandsPath)) {
    log.error(`Commands folder not found: ${commandsPath}`);
    return;
  }

  const files = await fs.readdir(commandsPath);
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    try {
      const cmd = await import(`./src/commands/${file}`);
      if (!cmd.default?.config) continue;
      global.client.commands.set(cmd.default.config.name, cmd.default);
      log.info(`Loaded command: ${cmd.default.config.name}`);
    } catch (err) {
      log.error(`Failed loading ${file}: ${err.message}`);
    }
  }

  log.success('All commands loaded!');
}

async function startBot() {
  await loadCommands();
  await loadPlugins();

  const index = await loadSessionIndex();
  const defaultSessionDir = path.resolve(__dirname, 'auth_info_baileys');

  sock = await createSocketForSession('main', defaultSessionDir, {
    onOpen: async (socket, state) => {
      const connected = state?.creds?.me?.id || 'unknown';
      figlet('BOT ONLINE', (err, data) => {
        if (!err) console.log(data);
      });
      log.success(`✅ WhatsApp connected as ${connected}`);
      if (config.bot?.number) {
        try {
          await socket.sendMessage(`${config.bot.number}@s.whatsapp.net`, {
            text: '✅ Bot session linked and online.'
          });
        } catch {}
      }
    }
  });

  global.client.mainSocket = sock;

  for (const session of index.sessions || []) {
    if (!session?.id || session.id === 'main') continue;
    const authDir = session.authDir || path.join(AUTH_ROOT, session.id);
    await createSocketForSession(session.id, authDir, {
      notifyNumber: session.notifyNumber || session.id
    });
  }

  if (process.stdin.isTTY && !process.env.AUTO_PAIR_NUMBER) {
    const answer = await rlPrompt(
      'Enter WhatsApp number(s) with country code (comma-separated) or press enter to skip: '
    );
    if (answer) process.env.AUTO_PAIR_NUMBER = answer;
  }

  let numbers = [];
  if (process.env.AUTO_PAIR_NUMBER) {
    const parsed = parsePairNumbers(process.env.AUTO_PAIR_NUMBER);
    numbers = parsed.valid;
    if (parsed.invalid.length) {
      log.warn(`Ignoring invalid pair number(s): ${parsed.invalid.join(', ')}`);
    }
  } else if (config.bot?.number) {
    const fallback = normalizePairNumber(config.bot.number);
    if (fallback) {
      numbers = [fallback];
      log.info(`AUTO_PAIR_NUMBER not set. Using BOT_NUMBER fallback (${fallback}).`);
    } else {
      log.warn('BOT_NUMBER is set but invalid. Use international format e.g. +2348012345678.');
    }
  }

  for (const num of numbers) {
    try {
      const authDir = path.join(AUTH_ROOT, num);
      const code = await createPairSession(num, authDir, num);
      console.log(`\nPAIR CODE for ${num}: ${code}`);
      console.log(`Copy this code and pair on WhatsApp Linked Devices.`);
    } catch (err) {
      console.log(`\nPAIR FAILED for ${num}: ${err.message}`);
    }
  }
}

startBot();
