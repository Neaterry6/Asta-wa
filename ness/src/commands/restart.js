
import { spawn } from 'child_process';

let restarting = false;

export default {
  config: {
    name: 'restart',
    description: 'Restarts the bot',
    usage: ['!restart'],
    category: 'owner',
  },
  onRun: async (sock, message) => {
    if (restarting) return;
    restarting = true;
    try {
      await sock.sendMessage(message.key.remoteJid, { text: 'Restarting...' });
      sock.end();
      const nodeProcess = spawn(process.argv[0], process.argv.slice(1), {
        detached: true,
        stdio: 'inherit',
      });
      nodeProcess.unref();
    } catch (error) {
      console.log(error);
    }
  },
}
