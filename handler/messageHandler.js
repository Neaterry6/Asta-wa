import config from "../config.js";
import log from "../includes/log.js";
import { checkPermission } from "../includes/utils.js";
import { handleReply } from "./replyHandler.js";
import { runPlugins } from "./pluginHandler.js";
import { getSettings } from "../includes/settings.js";
import { handleAiMention } from "./aiMentionHandler.js";

/* =========================
   JID RESOLVER
========================= */
function getSenderJid(message) {
  return (
    message.key.participantAlt ||
    message.key.participant ||
    message.key.remoteJid
  );
}

function buildContext(message) {
  return {
    jid: getSenderJid(message),
    chat: message.key.remoteJid,
    isGroup: message.key.remoteJid?.endsWith("@g.us"),
    message
  };
}

/* =========================
   ADMIN CHECK
========================= */
function isAdmin(message) {
  const jid = getSenderJid(message);
  return config.bot.admins.includes(jid);
}

/* =========================
   MAIN HANDLER
========================= */
async function handleMessage(sock, message) {
  if (config.consoleEvents) console.log(message);

  // ❌ Ignore invalid & self messages
  if (!message?.message) return;
  if (message.key.fromMe) return;

  message.reply = async (text, options = {}) => {
    await sock.sendMessage(
      message.key.remoteJid,
      { text, ...options },
      { quoted: message }
    );
  };

  const msg = message.message;
  const messageText =
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    null;

  if (!messageText) return;

  const text = messageText.trim();
  const lowerText = text.toLowerCase();
  const prefix = config.bot.prefix;
  const isPrefixCommand = text.startsWith(prefix);

  /* =========================
     REPLY CALLBACK SYSTEM (HIGH PRIORITY)
  ========================= */
  const userJid = getSenderJid(message);
  const replied = await handleReply(sock, message, userJid);
  if (replied) return;

  /* =========================
     AI MENTION HANDLER
  ========================= */
  if (await handleAiMention(sock, message)) return;

  /* =========================
     PLUGINS
  ========================= */
  const ctx = buildContext(message);
  const pluginResult = await runPlugins(sock, message, ctx);
  if (pluginResult === false) return;

  /* =========================
     AUTO RESPONDER
  ========================= */
  if (config.additional?.autoRespond?.enabled) {
    for (const trigger in config.additional.autoRespond.messages) {
      if (lowerText.includes(trigger.toLowerCase())) {
        await message.reply(config.additional.autoRespond.messages[trigger]);
        return;
      }
    }
  }

  /* =========================
     COMMAND PARSING
  ========================= */
  const args = text.split(/\s+/);
  const command = args[0].toLowerCase();
  const settings = getSettings();

  /* =========================
     CHAT COMMANDS (NO PREFIX)
  ========================= */
  for (const cmd of global.client.commands.values()) {
    if (
      cmd.onChat &&
      (cmd.config.name === command ||
        cmd.config.aliases?.includes(command))
    ) {
      if (
        settings.onlyAdminMode?.enabled &&
        !isAdmin(message) &&
        !cmd.config.ignoreAdminMode
      ) {
        return message.reply("🚫 Only admins can use bot commands right now.");
      }

      const permission = cmd.config.permission || cmd.config.Permission;
      if (permission) {
        const allowed = await checkPermission(sock, message, permission);
        if (!allowed) return;
      }

      try {
        await cmd.onChat(sock, message, args.slice(1));
      } catch (err) {
        log.error("onChat error:", err);
      }
      return;
    }
  }

  /* =========================
     PREFIX COMMANDS
  ========================= */
  if (!isPrefixCommand) return;

  const commandName = command.slice(prefix.length);
  const cmd = getCommandByNameOrAlias(commandName);

  if (!cmd) {
    await message.reply("Unknown command. Type .help to see available commands.");
    return;
  }

  if (
    settings.onlyAdminMode?.enabled &&
    !isAdmin(message) &&
    !cmd.config.ignoreAdminMode
  ) {
    return message.reply("🚫 Only admins can use bot commands right now.");
  }

  const permission = cmd.config.permission || cmd.config.Permission;
  if (permission) {
    const allowed = await checkPermission(sock, message, permission);
    if (!allowed) return;
  }

  try {
    await cmd.onRun(sock, message, args.slice(1));
  } catch (err) {
    log.error("Command error:", err);
    await message.reply(`❌ Error: ${err.message}`);
  }
}

/* =========================
   HELPERS
========================= */
function getCommandByNameOrAlias(name) {
  for (const cmd of global.client.commands.values()) {
    if (
      cmd.config.name === name ||
      cmd.config.aliases?.includes(name)
    ) {
      return cmd;
    }
  }
  return null;
}

export { handleMessage };
