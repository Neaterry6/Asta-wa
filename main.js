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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sock;
const activeSessions = new Map();
const AUTH_ROOT = path.resolve(__dirname, 'cache', 'sessions');
const SESSION_DB = path.resolve(__dirname, 'cache', 'session-index.json');

function cleanNumber(text = '') {
  return String(text).replace(/[^0-9]/g, '');
}

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

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && !opts.pairingOnly) {
      console.log(`\n[${sessionId}] Scan this QR to login:`);
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      activeSessions.set(sessionId, socket);
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
      if (code !== DisconnectReason.loggedOut) {
        log.warn(`[${sessionId}] Connection lost. Reconnecting...`);
        setTimeout(() => createSocketForSession(sessionId, authDir, opts), 3000);
      } else {
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

async function createPairSession(sessionId, authDir, notifyNumber = '') {
  const number = cleanNumber(sessionId);
  if (!number) throw new Error('invalid session id');

  await registerSessionMeta(number, authDir, notifyNumber || number);

  let sessionSock = activeSessions.get(number);
  if (!sessionSock) {
    sessionSock = await createSocketForSession(number, authDir, {
      notifyNumber: notifyNumber || number,
      pairingOnly: true
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 1500));
  const code = await sessionSock.requestPairingCode(number);

  await notifyAdmins(`🔐 Pair code created for ${number}: ${code}`);

  try {
    await sock.sendMessage(`${number}@s.whatsapp.net`, {
      text: `🔐 Pairing started for *${number}*. Use the code shown in the panel console or admin command reply.`
    });
  } catch {}

  return code;
}

global.client = {
  commands: new Map(),
  replies: new Map(),
  config,
  botadmin: config.adminIds,
  prefix: config.bot.prefix,
  pairSessions: new Map(),
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
    const answer = await rlPrompt('Pair numbers (comma-separated) or press enter to skip: ');
    if (answer) process.env.AUTO_PAIR_NUMBER = answer;
  }

  if (process.env.AUTO_PAIR_NUMBER) {
    const numbers = String(process.env.AUTO_PAIR_NUMBER)
      .split(/[\s,]+/)
      .map(cleanNumber)
      .filter(Boolean);

    for (const num of numbers) {
      try {
        const authDir = path.join(AUTH_ROOT, num);
        const code = await createPairSession(num, authDir, num);
        console.log(`\nPAIR CODE for ${num}: ${code}`);
      } catch (err) {
        console.log(`\nPAIR FAILED for ${num}: ${err.message}`);
      }
    }
  }
}

startBot();
