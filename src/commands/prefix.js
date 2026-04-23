import config from "../../config.js";

export default {
  config: {
    name: "prefix",
    description: "Shows the current bot prefix",
    usage: [".prefix"],
    category: "general",
  },

  onChat: async (sock, message) => {
    const prefix = config.bot.prefix;

    const text = `
╔══════════════╗
   ⚔️ ASTA BOT ⚔️
╚══════════════╝

🔹 *Current Prefix:*  \`${prefix}\`

Use it like:
${prefix}menu
${prefix}help

✨ Stay sharp. Stay powerful. Asta loves ya
`;

    await sock.sendMessage(
      message.key.remoteJid,
      { text },
      { quoted: message }
    );
  }
};
