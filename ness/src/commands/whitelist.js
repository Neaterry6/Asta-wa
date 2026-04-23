import config from "../../config.js";
import fs from 'fs-extra';



export default {
  config: {
    name: 'whitelist',
    description: 'Manages the whitelist',
    permission: 1,
    usage: ['!whitelist <on/off/add/remove> [jid]'],
    category: 'admin',
  },
  onRun: async (sock, message, args) => {
    const saveConfig = async () => {
  await fs.writeFile('./config.js', `export default ${JSON.stringify(config, null, 2).replace(/"true"/g, 'true').replace(/"false"/g, 'false')};`);
};

    try {
      if (!args[0]) {
        await sock.sendMessage(message.key.remoteJid, { text: 'Please provide a valid option (on/off/add/remove)' });
        return;
      }

      switch (args[0].toLowerCase()) {
        case 'on':
          config.whitelist.enabled = true;
          await saveConfig();
          await sock.sendMessage(message.key.remoteJid, { text: 'Whitelist enabled' });
          break;
        case 'off':
          config.whitelist.enabled = false;
          await saveConfig();
          await sock.sendMessage(message.key.remoteJid, { text: 'Whitelist disabled' });
          break;
        case 'add':
          if (!args[1]) {
            await sock.sendMessage(message.key.remoteJid, { text: 'Please provide a JID to add to the whitelist' });
            return;
          }
          const jidToAdd = args[1] + '@s.whatsapp.net';
          if (config.whitelist.users.includes(jidToAdd)) {
            await sock.sendMessage(message.key.remoteJid, { text: 'User is already whitelisted' });
            return;
          }
          config.whitelist.users.push(jidToAdd);
          await saveConfig();
          await sock.sendMessage(message.key.remoteJid, { text: `User ${jidToAdd} has been whitelisted` });
          break;
        case 'remove':
          if (!args[1]) {
            await sock.sendMessage(message.key.remoteJid, { text: 'Please provide a JID to remove from the whitelist' });
            return;
          }
          const jidToRemove = args[1] + '@s.whatsapp.net';
          const index = config.whitelist.users.indexOf(jidToRemove);
          if (index === -1) {
            await sock.sendMessage(message.key.remoteJid, { text: 'User is not whitelisted' });
            return;
          }
          config.whitelist.users.splice(index, 1);
          await saveConfig();
          await sock.sendMessage(message.key.remoteJid, { text: `User ${jidToRemove} has been removed from the whitelist` });
          break;
        default:
          await sock.sendMessage(message.key.remoteJid, { text: 'Invalid option' });
          break;
      }
    } catch (error) {
      console.error('Error running whitelist command:', error.message, error.stack);
      await sock.sendMessage(message.key.remoteJid, { text: `An error occurred while running the command: ${error.message}` });
    }
  },
};
