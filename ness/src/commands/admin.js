import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.resolve(__dirname, "../../config.js");

/* ================= HELPERS ================= */

async function loadConfigFresh() {
  const url = pathToFileURL(CONFIG_PATH).href + `?v=${Date.now()}`;
  return (await import(url)).default;
}

function saveConfig(obj) {
  fs.writeFileSync(
    CONFIG_PATH,
    "export default " + JSON.stringify(obj, null, 2) + ";\n",
    "utf8"
  );
}

/* Resolve LID → real JID */



function extractTargetRaw(message, args) {
  const ctx = message.message?.extendedTextMessage?.contextInfo;

  // reply
  if (ctx?.participant) return ctx.participant;

  // mention
  if (ctx?.mentionedJid?.length) return ctx.mentionedJid[0];

  // manual argument
  if (args[1]) return args[1];

  return null;
}


async function getName(sock, jid, message) {
  if (!jid) return "Unknown";

  // 1️⃣ Try contacts cache
  const contact = sock.contacts?.[jid];
  if (contact?.name) return contact.name;
  if (contact?.notify) return contact.notify;

  // 2️⃣ Try group metadata (best for LID-resolved users)
  if (message?.key?.remoteJid?.endsWith("@g.us")) {
    try {
      const meta = await sock.groupMetadata(message.key.remoteJid);
      const participant = meta.participants.find(p => p.jid === jid);
      if (participant?.name) return participant.name;
      if (participant?.notify) return participant.notify;
    } catch {}
  }

  // 3️⃣ Try WhatsApp lookup (fallback)
  try {
    const res = await sock.onWhatsApp(jid);
    if (res?.[0]?.notify) return res[0].notify;
  } catch {}

  // 4️⃣ Final fallback → number
  return jid.split("@")[0];
}


/* ================= COMMAND ================= */

export default {
  config: {
    name: "admin",
    description: "Manage bot admins",
    usage: [
      ".admin add <reply | @ | lid>",
      ".admin remove <reply | @ | lid>",
      ".admin list",
      ".admin info <lid>"
    ],
    category: "owner",
    Permission: 1
  },

  onRun: async (sock, message, args) => {
    const sender =
      message.key.participantAlt ||
      message.key.participant ||
      message.key.remoteJidAlt;

    const config = await loadConfigFresh();
    config.bot.admins ||= [];

    if (!config.bot.admins.includes(sender)) {
        console.log(`here: ${sender}`);
      return sock.sendMessage(
        message.key.remoteJid,
        { text: "❌ Only bot admins can use this command." },
        { quoted: message }
      );
    }

    const action = args[0];

    if (!action) {
      return sock.sendMessage(
        message.key.remoteJid,
        {
          text:
`🛠 *ADMIN MANAGER*

.admin add <reply | @ | lid>
.admin remove <reply | @ | lid>
.admin list
.admin info <lid>`
        },
        { quoted: message }
      );
    
    }

    const admins = config.bot.admins;

    /* ================= LIST ================= */
    if (action === "list") {
      if (!admins.length) {
        return sock.sendMessage(
          message.key.remoteJid,
          { text: "⚠️ No admins configured." },
          { quoted: message }
        );
      }

      let text = `👑 *Bot Admins (${admins.length})*\n\n`;
const mentions = [];

admins.forEach((jid, i) => {
  if (!jid || typeof jid !== "string") return;

  const num = jid.split("@")[0];
  mentions.push(jid);

  text += `${i + 1}. @${num}\n`;
});


await sock.sendMessage(
  message.key.remoteJid,
  {
    text,
    mentions
  },
  { quoted: message }
);
return;
    }

    /* ================= INFO ================= */
    if (action === "info") {
      const raw = args[1];
      const jid = await resolveToJid(sock, message, raw);

      if (!jid)
        return sock.sendMessage(
          message.key.remoteJid,
          { text: "❌ Invalid user." },
          { quoted: message }
        );

   const name = await getName(sock, jid, message);
const isAdmin = admins.includes(jid);
const num = jid.split("@")[0];

await sock.sendMessage(
  message.key.remoteJid,
  {
    text:
`👤 *ADMIN INFO*

• User: @${num}
• JID: ${jid}
• Status: ${isAdmin ? "✅ Admin" : "❌ Not Admin"}`,
    mentions: [jid]
  },
  { quoted: message }
);

return;
    }

    if (!["add", "remove"].includes(action)) {
      return sock.sendMessage(
        message.key.remoteJid,
        { text: "❌ Invalid action." },
        { quoted: message }
      );
    }

    const rawTarget = extractTargetRaw(message, args);
    const target = rawTarget;


    if (!target) {
      return sock.sendMessage(
        message.key.remoteJid,
        { text: "❌ Provide a valid reply, mention, or LID." },
        { quoted: message }
      );
    }

    const exists = admins.includes(target);

    /* prevent self removal */
    if (action === "remove" && target === sender) {
      return sock.sendMessage(
        message.key.remoteJid,
        { text: "❌ You cannot remove yourself as admin." },
        { quoted: message }
      );
    }

    /* ================= ADD ================= */
    if (action === "add") {
      if (exists) {
        return sock.sendMessage(
          message.key.remoteJid,
          { text: "⚠️ This user is already an admin." },
          { quoted: message }
        );
      }

      admins.push(target);
      config.bot.admins = admins;
      saveConfig(config);

      const name = await getName(sock, target, message);

      return sock.sendMessage(
        message.key.remoteJid,
        {
          text: `✅ Admin added:\n${target}`
        },
        { quoted: message }
      );
    }

    /* ================= REMOVE ================= */
    if (action === "remove") {
      if (!exists) {
        return sock.sendMessage(
          message.key.remoteJid,
          { text: "⚠️ This user is not an admin." },
          { quoted: message }
        );
      }

      config.bot.admins = admins.filter(a => a !== target);
      saveConfig(config);

      const name = await getName(sock, target, message);

      return sock.sendMessage(
        message.key.remoteJid,
        {
          text: `❌ Admin removed:\n${name}\n${target}`
        },
        { quoted: message }
      );
    }
  }
};
