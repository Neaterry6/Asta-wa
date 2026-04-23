import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const plugins = [];

for (const file of fs.readdirSync(__dirname)) {
  if (!file.endsWith(".js") || file === "index.js") continue;

  const plugin = (await import(`./${file}`)).default;
  if (plugin) plugins.push(plugin);
}

export default plugins;
