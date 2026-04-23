import config from "../config.js";

export default {
  name: "only-admin",

  async onMessage(sock, message, ctx) {
    if (!config.onlyAdminMode?.enabled) return;

    if (!config.bot.admins.includes(ctx.jid)) {
      await sock.sendMessage(
        ctx.chat,
        { text: "❌ Only admins can use the bot right now." },
        { quoted: message }
      );
      return false;
    }
  }
};
