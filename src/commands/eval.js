import util from "util";
import config from "../../config.js";

export default {
  config: {
    name: "eval",
    description: "Execute JavaScript (admin only)",
    usage: [".eval <js code>"],
    category: "admin",
    Permission: 1
  },

  onRun: async (sock, message, args) => {

    let code = args.join(" ");
    if (!code) {
      return sock.sendMessage(
        message.key.remoteJid,
        { text: "Usage:\n.shell <javascript code>" },
        { quoted: message }
      );
    }

    try {
      // If user didn't explicitly return, wrap last line
      if (!code.includes("return")) {
        const lines = code.split("\n");
        const last = lines.pop();

        // auto-return last expression
        lines.push(`return (${last});`);
        code = lines.join("\n");
      }

      const asyncEval = async () => {
        return await eval(`(async () => {\n${code}\n})()`);
      };

      let result = await asyncEval();

      if (typeof result !== "string") {
        result = util.inspect(result, {
          depth: 3,
          maxArrayLength: 20,
          breakLength: 80
        });
      }

      if (!result) result = "undefined";

      if (result.length > 3500) {
        result = result.slice(0, 3500) + "\n... (truncated)";
      }

      await sock.sendMessage(
        message.key.remoteJid,
        { text: "```js\n" + result + "\n```" },
        { quoted: message }
      );
    } catch (err) {
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text:
            "❌ Error:\n```js\n" +
            (err.stack || err.message) +
            "\n```"
        },
        { quoted: message }
      );
    }
  }
};
