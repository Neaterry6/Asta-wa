import { spawn } from "child_process";
import log from "./includes/log.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function start() {
  const bot = spawn(process.execPath, ["main.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: false,
  });

  bot.on("close", (code) => {
    if (code === 2) {
      log.info("Bot is restarting.");
      start();
    }
  });

  bot.on("error", (err) => {
    log.error(`Error starting bot: ${err.message}`);
  });
}

start();
