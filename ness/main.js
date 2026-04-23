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
import { fileURLToPath } from 'url';

import config from './config.js';
import log from './includes/log.js';
import { loadPlugins } from "./handler/pluginHandler.js";
import { handleMessage } from './handler/messageHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sock;

/* =========================
   GLOBAL CLIENT
========================= */
global.client = {
  commands: new Map(),
  replies: new Map(),
  config,
  botadmin: config.adminIds,
  prefix: config.bot.prefix
};

/* =========================
   LOAD COMMANDS
========================= */
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

/* =========================
   CONNECT TO WHATSAPP
========================= */
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');

  sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: Browsers.ubuntu('MyBot'),
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.clear();
      console.log('📱 Scan this QR to login:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      log.success('✅ WhatsApp connected!');
      figlet('BOT ONLINE', (err, data) => {
        if (!err) console.log(data);
      });
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;

      if (code !== DisconnectReason.loggedOut) {
        log.warn('Connection lost. Reconnecting...');
        setTimeout(connectToWhatsApp, 3000);
      } else {
        log.error('Logged out. Delete auth_info_baileys and scan again.');
      }
    }
  });

  /* MESSAGE HANDLER */


sock.ev.on("messages.upsert", async ({ messages, type }) => {
  if (type !== "notify") return;

  for (let mek of messages) {
    try {
      if (!mek?.message) continue;

      // unwrap ephemeral
      if (mek.message.ephemeralMessage) {
        mek.message = mek.message.ephemeralMessage.message;
      }

      const isGroup = mek.key.remoteJid?.endsWith("@g.us");
      const ctx = mek.message?.extendedTextMessage?.contextInfo;

      if (
        isGroup &&
        ctx?.mentionedJid?.some(j => j.endsWith("@lid"))
      ) {
        const metadata = await sock.groupMetadata(mek.key.remoteJid);

        const lidMap = {};

        for (const lid of ctx.mentionedJid) {
          if (!lid.endsWith("@lid")) continue;

          const match = metadata.participants.find(p => p.id === lid);
          if (match?.jid) lidMap[lid] = match.jid;
        }

        // replace mentionedJid
        ctx.mentionedJid = ctx.mentionedJid.map(j => lidMap[j] || j);

        const replaceText = (text) => {
          if (!text) return text;
          for (const [lid, jid] of Object.entries(lidMap)) {
            const lidNum = lid.split("@")[0];
            const jidNum = jid.split("@")[0];
            text = text.replace(
              new RegExp(`@${lidNum}\\b`, "g"),
              `@${jidNum}`
            );
          }
          return text;
        };

        if (mek.message.conversation)
          mek.message.conversation = replaceText(mek.message.conversation);

        if (mek.message.extendedTextMessage?.text)
          mek.message.extendedTextMessage.text =
            replaceText(mek.message.extendedTextMessage.text);
      }

      // send normalized message to handler
      await handleMessage(sock, mek);

    } catch (err) {
      log.error("Message error:", err);
    }
  }
});

}

/* =========================
   START BOT
========================= */
async function startBot() {
  await loadCommands();
  await loadPlugins();
  await connectToWhatsApp();
}

startBot();
