export default {
  config: {
    name: "owner",
    aliases: ["creator", "admin"],
    description: "Shows bot owner information",
    category: "info"
  },

  onRun: async (sock, message) => {
    const ownerNumber = "23439977668"; // 🔴 CHANGE THIS
    const ownerJid = `${ownerNumber}@s.whatsapp.net`;
    const lid = `63097851101285@lid`
    const chat = message.key.remoteJid;

    let pfp;
    try {
      pfp = await sock.profilePictureUrl(lid, "image");
    } catch {
      pfp = "./src/uploads/asta.jpeg"; // fallback image
    }

    const caption =
      `👑 *BOT OWNER*\n\n` +
      `👤 *Name:* Asta Ichiyukimori\n` +
      `🌍 *Country:* Nigeria\n` +
      `👤 *Age:* 17\n` +
      `💻 *Role:* Bot Developer & Maintainer\n\n` +
      `📞 *WhatsApp:* wa.me/${ownerNumber}\n\n` +
      `⚠️ Contact only for bot-related issues.`;

    await sock.sendMessage(
      chat,
      {
        image: { url: pfp },
        caption,
        buttons: [
          {
            buttonId: `https://wa.me/${ownerNumber}`,
            buttonText: { displayText: "💬 Chat Owner" },
            type: 1
          }
        ],
        headerType: 4
      },
      { quoted: message }
    );
  }
};
