export default {
  name: "view-once-detector",

  async onMessage(sock, message) {
    if (message.message?.viewOnceMessageV2) {
      await sock.sendMessage(
        message.key.remoteJid,
        { text: "👀 View-once message detected" },
        { quoted: message }
      );
    }
  }
};
