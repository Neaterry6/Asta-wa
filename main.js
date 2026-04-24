import "dotenv/config";
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} from '@whiskeysockets/baileys';
import { proto } from "@whiskeysockets/baileys";

import pino from 'pino';
import qrcode from 'qrcode-terminal';
import figlet from 'figlet';
import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

import config from './config.js';
import log from './includes/log.js';
import { loadPlugins } from "./handler/pluginHandler.js";
import { handleMessage } from './handler/messageHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sock;
const activeSessions = new Map();
const AUTH_ROOT = path.resolve(__dirname, 'cache', 'sessions');
const SESSION_INDEX = path.resolve(__dirname, 'cache', 'session-index.json');
const SESSION_DB = path.resolve(__dirname, 'cache', 'session-index.json');

function rlPrompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

async function loadSessionIndex() {
  try { return await fs.readJson(SESSION_DB); } catch { return { sessions: [] }; }
}

async function saveSessionIndex(index) {
  await fs.ensureDir(path.dirname(SESSION_DB));
  await fs.writeJson(SESSION_DB, index, { spaces: 2 });
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
    if (qr) {
      console.log(`\n[${sessionId}] Scan this QR to login:`);
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      activeSessions.set(sessionId, socket);
      log.success(`[${sessionId}] WhatsApp connected`);
      if (opts.notifyNumber) {
        try {
          await socket.sendMessage(`${opts.notifyNumber}@s.whatsapp.net`, {
            text: `✅ Session ${sessionId} linked successfully.`
          });
        } catch (e) {
          log.warn(`[${sessionId}] notify failed: ${e.message}`);
        }
      }
      if (opts.onOpen) {
        try { await opts.onOpen(socket, state); } catch (e) { log.error(`[${sessionId}] onOpen failed: ${e.message}`); }
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

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (let mek of messages) {
      try {
        if (!mek?.message) continue;
        if (mek.message.ephemeralMessage) mek.message = mek.message.ephemeralMessage.message;
        const isGroup = mek.key.remoteJid?.endsWith("@g.us");
        const ctx = mek.message?.extendedTextMessage?.contextInfo;
        if (isGroup && ctx?.mentionedJid?.some(j => j.endsWith("@lid"))) {
          const metadata = await socket.groupMetadata(mek.key.remoteJid);
          const lidMap = {};
          for (const lid of ctx.mentionedJid) {
            if (!lid.endsWith("@lid")) continue;
            const match = metadata.participants.find(p => p.id === lid);
            if (match?.jid) lidMap[lid] = match.jid;
          }
          ctx.mentionedJid = ctx.mentionedJid.map(j => lidMap[j] || j);
          const replaceText = (text) => {
            if (!text) return text;
            for (const [lid, jid] of Object.entries(lidMap)) {
              const lidNum = lid.split("@")[0];
              const jidNum = jid.split("@")[0];
              text = text.replace(new RegExp(`@${lidNum}\\b`, "g"), `@${jidNum}`);
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


global.client = {
  commands: new Map(),
  replies: new Map(),
  config,
  botadmin: config.adminIds,
  prefix: config.bot.prefix,
  pairSessions: new Map(),
  registerSession: async (sessionId, authDir) => {
    const index = await loadSessionIndex();
    index.sessions ||= [];
    if (!index.sessions.some(s => s.id === sessionId)) {
      index.sessions.push({ id: sessionId, authDir });
      await saveSessionIndex(index);
    }
  },
  requestPairCode: async (phoneNumber, sessionId = 'main') => {
    const target = activeSessions.get(sessionId) || sock;
    if (!target?.requestPairingCode) throw new Error(`session ${sessionId} not ready`);
    const code = await target.requestPairingCode(phoneNumber);
    return code;
  },
  createPairedSession: async (sessionId, authDir, opts = {}) => {
    return createSocketForSession(sessionId, authDir, opts);
  },
  sessionIndexPath: SESSION_INDEX
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
        try { await socket.sendMessage(`${config.bot.number}@s.whatsapp.net`, { text: '✅ Bot session linked and online.' }); } catch {}
      }
    }
  });

  for (const session of index.sessions || []) {
    const authDir = session.authDir || path.join(AUTH_ROOT, session.id);
    await createSocketForSession(session.id, authDir);
  }

  if (process.stdin.isTTY && !process.env.AUTO_PAIR_NUMBER) {
    const answer = await rlPrompt('pairing mode? enter a phone number to pair or press enter to skip: ');
    if (answer) process.env.AUTO_PAIR_NUMBER = answer.replace(/[^0-9]/g, '');
  }

  if (process.env.AUTO_PAIR_NUMBER) {
    const num = process.env.AUTO_PAIR_NUMBER.replace(/[^0-9]/g, '');
    const code = await sock.requestPairingCode(num);
    console.log(`
PAIR CODE for ${num}: ${code}`);
    index.sessions ||= [];
    if (!index.sessions.some(s => s.id === num)) {
      index.sessions.push({ id: num, authDir: path.join(AUTH_ROOT, num) });
      await saveSessionIndex(index);
    }
  }
}

startBot();
