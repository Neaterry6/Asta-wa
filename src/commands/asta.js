import { GoogleGenAI } from "@google/genai";
import config from "../../config.js";
import {
  getHistory,
  addToHistory,
  clearHistory
} from "../../includes/aiMemory.js";
import { setReplyCallback } from "../../handler/replyHandler.js";

const ai = new GoogleGenAI({
  apiKey: config.keys.gemini
});

const SYSTEM_PROMPT = `
you are asta bot created by asta ichiyukimori you'll you will act and reply like you're a boss`;

export default {
  config: {
    name: "asta",
    aliases: ["asta-kun", "astabot", "asta-bot"],
    description: "Chat with AI",
    usage: [".ai hello", ".ai explain gravity"],
    category: "tools"
  },

  onRun: async (sock, message, args) => {
    const jid =
      message.key.participantAlt ||
      message.key.participant ||
      message.key.remoteJid;

    if (!args.length) {
      return message.reply("yes?,whatchu want?");
    }

    const userText = args.join(" ");

    try {

      addToHistory(jid, "user", userText);

      const contents = [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        ...getHistory(jid)
      ];

      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents
      });

      const aiText = res.text || "⚠️ No response.";

      addToHistory(jid, "model", aiText);

      const sent = await sock.sendMessage(
        message.key.remoteJid,
        { text: aiText.slice(0, 4000) },
        { quoted: message }
      );

      // 🔁 CONTINUE IF USER REPLIES
      setReplyCallback(sent.key.id, jid, async (sock, replyMsg) => {
        const text =
          replyMsg.message?.conversation ||
          replyMsg.message?.extendedTextMessage?.text;

        if (!text) return;

        addToHistory(jid, "user", text);

        const followUp = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            ...getHistory(jid)
          ]
        });

        const replyText = followUp.text || "⚠️ No response.";

        addToHistory(jid, "model", replyText);

        await replyMsg.reply(replyText.slice(0, 4000));
      });

    } catch (err) {
      console.error("AI error:", err);
      await message.reply("❌ AI error. Try again later.");
    }
  }
};
