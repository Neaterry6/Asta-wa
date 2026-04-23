import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const plugins = [];

export async function loadPlugins() {
  const pluginsDir = path.resolve(__dirname, "../plugins");

  if (!fs.existsSync(pluginsDir)) return;

  const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith(".js"));

  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(path.join(pluginsDir, file)));
      if (mod.default) {
        plugins.push(mod.default);
        console.log(`[PLUGIN] Loaded → ${file}`);
      }
    } catch (err) {
      console.error(`[PLUGIN ERROR] ${file}`, err);
    }
  }
}



export async function runPlugins(sock, message, ctx) {
  for (const plugin of plugins) {
    if (typeof plugin.onMessage === "function") {
      const result = await plugin.onMessage(sock, message, ctx);
      if (result === false) return false; // stop processing
    }
  }
  return true;
}
