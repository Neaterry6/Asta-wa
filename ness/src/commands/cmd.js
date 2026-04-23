import fs from "fs";
import path from "path";
import config from "../../config.js";
import { pathToFileURL } from "url";

const COMMAND_DIR = path.resolve("./src/commands");

// ================= HELPERS =================


function normalizeCode(code) {
  if (!code) return "";

  return code
    // restore escaped newlines from WhatsApp
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    // normalize actual CRLF
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim() + "\n";
}

function validateCommandCode(code) {
  if (!code.includes("export default")) return "Missing `export default`";
  if (!code.includes("config")) return "Missing `config` object";
  if (!code.includes("name")) return "Missing command name";
  if (!code.includes("onRun") && !code.includes("onChat"))
    return "Command must have `onRun` or `onChat`";
  return true;
}

async function fetchRaw(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch raw file");
  return await res.text();
}

async function reloadCommand(filename) {
  const filePath = path.join(COMMAND_DIR, filename);
  const fileUrl = pathToFileURL(filePath).href + `?update=${Date.now()}`;

  const imported = await import(fileUrl);

  if (!imported.default?.config?.name) {
    throw new Error("Invalid command export");
  }

  global.client.commands.set(
    imported.default.config.name,
    imported.default
  );
}

// ================= COMMAND =================

export default {
  config: {
    name: "cmd",
    description: "Install, edit, delete, reload, export commands",
    usage: [
      ".cmd install file.js <code|raw>",
      ".cmd edit file.js <code|raw>",
      ".cmd delete file.js",
      ".cmd reload file.js",
      ".cmd export file.js",
      ".cmd list"
    ],
    category: "admin",
    Permission: 1
  },

  onRun: async (sock, message, args) => {
  

    const action = args[0];
    const filename = args[1];

    if (!action) {
      return sock.sendMessage(
        message.key.remoteJid,
        {
          text: `🛠 *ASTA COMMAND MANAGER*

.cmd install file.js <code|raw>
.cmd edit file.js <code|raw>
.cmd delete file.js
.cmd reload file.js
.cmd export file.js
.cmd list`
        },
        { quoted: message }
      );
    }

    // ================= LIST =================
    if (action === "list") {
      const files = fs.readdirSync(COMMAND_DIR).filter(f => f.endsWith(".js"));

      return sock.sendMessage(
        message.key.remoteJid,
        {
          text:
`📂 *Installed Commands (${files.length})*\n\n` +
files.map(f => `• ${f}`).join("\n")
        },
        { quoted: message }
      );
    }

    if (!filename || !filename.endsWith(".js")) {
      return sock.sendMessage(
        message.key.remoteJid,
        { text: "❌ File name must end with `.js`" },
        { quoted: message }
      );
    }

    const filePath = path.join(COMMAND_DIR, filename);

    // ================= EXPORT =================
    if (action === "export") {
      if (!fs.existsSync(filePath)) {
        return sock.sendMessage(
          message.key.remoteJid,
          { text: "❌ Command file not found." },
          { quoted: message }
        );
      }

      return sock.sendMessage(
        message.key.remoteJid,
        {
          document: fs.readFileSync(filePath),
          fileName: filename,
          mimetype: "application/javascript"
        },
        { quoted: message }
      );
    }

    // ================= DELETE =================
    if (action === "delete") {
      if (!fs.existsSync(filePath)) {
        return sock.sendMessage(
          message.key.remoteJid,
          { text: "❌ Command not found." },
          { quoted: message }
        );
      }

      fs.unlinkSync(filePath);
      global.client.commands.delete(filename.replace(".js", ""));

      return sock.sendMessage(
        message.key.remoteJid,
        { text: `✅ Deleted *${filename}*` },
        { quoted: message }
      );
    }

    // ================= RELOAD =================
    if (action === "reload") {
      if (!fs.existsSync(filePath)) {
        return sock.sendMessage(
          message.key.remoteJid,
          { text: "❌ Command not found." },
          { quoted: message }
        );
      }

      try {
        await reloadCommand(filename);
        return sock.sendMessage(
          message.key.remoteJid,
          { text: `♻️ Reloaded *${filename}* successfully.` },
          { quoted: message }
        );
      } catch (e) {
        return sock.sendMessage(
          message.key.remoteJid,
          { text: `❌ Reload failed:\n${e.message}` },
          { quoted: message }
        );
      }
    }

    // ================= INSTALL / EDIT =================
    if (!["install", "edit"].includes(action)) {
      return sock.sendMessage(
        message.key.remoteJid,
        { text: "❌ Invalid action." },
        { quoted: message }
      );
    }

    const DIR = path.join(COMMAND_DIR, filename);

    if (action === "install" && fs.existsSync(filePath)) {
      return sock.sendMessage(
        message.key.remoteJid,
        { text: "⚠️ Command already exists. Use `.cmd edit`." },
        { quoted: message }
      );
    }

    if (action === "edit" && !fs.existsSync(filePath)) {
      return sock.sendMessage(
        message.key.remoteJid,
        { text: "❌ Command does not exist. Use install instead." },
        { quoted: message }
      );
    }


let content = "";

// ✅ FILE UPLOAD (BEST + SAFE)


  if (!fileName.endsWith(".js")) {
    return sock.sendMessage(
      message.key.remoteJid,
      { text: "❌ Please upload a .js file only." },
      { quoted: message }
    )} else {
      fs.writeFile(DIR)
    }

// ✅ RAW URL (GitHub / Pastebin)
if (args.slice(2).join(" ").startsWith("http")) {
  try {
    content = await fetchRaw(args.slice(2).join(" "));
  } catch {
    return sock.sendMessage(
      message.key.remoteJid,
      { text: "❌ Failed to fetch raw file." },
      { quoted: message }
    );
  }
}

// ❌ BLOCK PASTED CODE
else {
  return sock.sendMessage(
    message.key.remoteJid,
    {
      text:
        "⚠️ Code pasted in chat loses formatting and CANNOT be installed.\n\n" +
        "✅ Please upload the `.js` file instead\n" +
        "or provide a raw GitHub URL."
    },
    { quoted: message }
  );
}


    if (!content) {
      return sock.sendMessage(
        message.key.remoteJid,
        { text: "❌ No command code or raw link provided." },
        { quoted: message }
      );
    }

    // RAW LINK
    if (content.startsWith("http")) {
      try {
        content = await fetchRaw(content);
      } catch {
        return sock.sendMessage(
          message.key.remoteJid,
          { text: "❌ Failed to fetch raw file." },
          { quoted: message }
        );
      }
    }

    content = normalizeCode(content);

    const validation = validateCommandCode(content);
    if (validation !== true) {
      return sock.sendMessage(
        message.key.remoteJid,
        { text: `❌ Invalid command:\n${validation}` },
        { quoted: message }
      );
    }

    fs.writeFileSync(filePath, content, "utf8");

    try {
      await reloadCommand(filename);
    } catch (e) {
      return sock.sendMessage(
        message.key.remoteJid,
        { text: `⚠️ Saved but failed to load:\n${e.message}` },
        { quoted: message }
      );
    }

    await sock.sendMessage(
      message.key.remoteJid,
      {
        text:
          action === "install"
            ? `✅ Installed *${filename}* successfully.`
            : `✅ Updated *${filename}* successfully.`
      },
      { quoted: message }
    );
  }
};
