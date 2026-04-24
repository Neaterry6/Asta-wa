export default {
  config: {
    name: 'menu',
    aliases: ["help"],
    description: 'Show Asta bot command menu',
    usage: ['.menu'],
    category: 'general',
  },

  onRun: async (sock, message, args) => {
    const prefix = global.client.prefix;
    const commands = Array.from(global.client.commands.values());
if (args.length === 0) {

    // Group commands by category
    const categories = {};
    for (const cmd of commands) {
      const cat = cmd.config.category || "other";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd);
    }

    let menu = `
╔══════════════════╗
    ⚔️  *ASTA MENU*  ⚔️
╚══════════════════╝

👤 *User:* @${message.key.participant?.split("@")[0] || message.key.remoteJid.split("@")[0]}
🧠 *Prefix:* .
📦 *Commands:* ${commands.length}

━━━━━━━━━━━━━━━━━━━━━━
`;

    for (const [category, cmds] of Object.entries(categories)) {
      menu += `\n🔹 *${category.toUpperCase()}*\n`;

      for (const cmd of cmds) {
        menu += `  ▸ .${cmd.config.name}`;
        if (cmd.config.description) {
          menu += ` — ${cmd.config.description}`;
        }
        menu += "\n";
      }
    }

    menu += `
━━━━━━━━━━━━━━━━━━━━━━
✨ *Asta Bot — Power. Speed. Control.*
⚡ Developed with Baileys

🔗 *Pairing:* `.pair`, `.multipair`
`;

    await sock.sendMessage(
      message.key.remoteJid,
      {
        image: {
          url: "./src/uploads/image.png"
        },
        caption: `${menu}\n *Type ${prefix}menu <command name> to see the command description`,
        mentions: [
          message.key.participant || message.key.remoteJid
        ]
      },
      { quoted: message }
    );
  } else {
    const commandName = args[0].toLowerCase();
        const cmd = Array.from(global.client.commands.values()).find((c) => c.config.name === commandName || c.config.aliases?.includes(commandName));
        if (cmd && cmd.config) {
          let helpText = `
╔══════════════════╗
     ⚔️  *ASTA*  ⚔️
╚══════════════════╝`
          helpText += `🔹*Command:* ${prefix}${cmd.config.name}\n`;
          helpText += `🔹*Description:* ${cmd.config.description || 'No description'}\n`;
          helpText += `🔹*Usage:* ${cmd.config.usage ? cmd.config.usage.join('\n') : 'No usage information'}\n`;
          helpText += `🔹*Category:* ${cmd.config.category || 'No category'}\n`;
          await message.reply(helpText);
        } else {
          await message.reply('Unknown command.');
        }
  }
  }
};
