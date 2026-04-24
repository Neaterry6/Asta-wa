import { GoogleGenAI } from "@google/genai";
import axios from "axios";
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

async function qwenChat(messages) {
  const baseURL = config.qwen?.baseUrl || "https://qwen.aikit.club";
  const token = process.env.QWEN_API_KEY || config.qwen?.apiKey;
  if (!token) return null;
  const model = getCurrentModel();
  const res = await axios.post(`${baseURL}/v1/chat/completions`, {
    model,
    messages
  }, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    timeout: 120000
  });
  return res.data?.choices?.[0]?.message?.content?.trim() || null;
}

function getCurrentModel() {
  try {
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync("data/qwen-model.json", "utf-8"));
    return data.model || config.qwen?.defaultModel || "Qwen3.6-Plus";
  } catch {
    return config.qwen?.defaultModel || "Qwen3.6-Plus";
  }
}

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

      let aiText = await qwenChat([
        { role: "system", content: SYSTEM_PROMPT },
        ...getHistory(jid).map(h => ({ role: h.role === "model" ? "assistant" : h.role, content: h.parts ? h.parts.map(p => p.text).join(" ") : h.content }))
      ]);

      if (!aiText) {
        const res = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents
        });
        aiText = res.text || "⚠️ No response.";
      }

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

        let replyText = await qwenChat([
          { role: "system", content: SYSTEM_PROMPT },
          ...getHistory(jid).map(h => ({ role: h.role === "model" ? "assistant" : h.role, content: h.parts ? h.parts.map(p => p.text).join(" ") : h.content }))
        ]);

        if (!replyText) {
          const followUp = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
              ...getHistory(jid)
            ]
          });
          replyText = followUp.text || "⚠️ No response.";
        }

        addToHistory(jid, "model", replyText);

        await replyMsg.reply(replyText.slice(0, 4000));
      });

    } catch (err) {
      console.error("AI error:", err);
      await message.reply("❌ AI error. Try again later.");
    }
  }
};
