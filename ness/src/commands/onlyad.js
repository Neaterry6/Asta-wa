import fs from "fs";
import path from "path";

const settingsPath = path.resolve("data/settings.json");

function loadSettings() {
  if (!fs.existsSync(settingsPath)) {
    fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ onlyAdminMode: { enabled: false } }, null, 2)
    );
  }
  return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
}

function saveSettings(data) {
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
}

export default {
  config: {
    name: "onlyad",
    description: "Toggle only-admin mode",
    permission: 1,
    usage: [".onlyad on", ".onlyad off"],
    category: "admin"
  },

  onRun: async (sock, message, args) => {
    const option = args[0]?.toLowerCase();

    if (!["on", "off"].includes(option)) {
      return sock.sendMessage(
        message.key.remoteJid,
        { text: "Usage: .onlyad on | off" },
        { quoted: message }
      );
    }

    const settings = loadSettings();
    settings.onlyAdminMode.enabled = option === "on";
    saveSettings(settings);

    await sock.sendMessage(
      message.key.remoteJid,
      {
        text: `✅ Only admin mode is now *${
          settings.onlyAdminMode.enabled ? "ENABLED" : "DISABLED"
        }*`
      },
      { quoted: message }
    );
  }
};
