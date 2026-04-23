export default {
  config: {
    name: "jid",
    description: "Get a user's JID",
    usage: [".jid", ".jid @user", "reply → .jid"],
    category: "general"
  },

  onRun: async (sock, message, args) => {
    let jid;

    // 1️⃣ If replying to someone
    jid = message.message?.extendedTextMessage?.contextInfo?.participantAlt;

    // 2️⃣ If mentioning someone
    if (!jid && message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
      jid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }

    // 3️⃣ Fallback to sender
    if (!jid) {
      jid = message.key.participantAlt || message.key.remoteJid;

    await sock.sendMessage(
      message.key.remoteJid,
      { text: `🆔 JID:\n${jid}` },
      { quoted: message }
    );
  }
}
};
