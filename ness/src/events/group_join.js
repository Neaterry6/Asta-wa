import config from "../../config.js";

export default async (sock, event) => {
  if (config.additional.groups.autoJoin) {
    // Auto-join group logic here
  }

  // Send welcome message
  if (config.additional.groups.welcomeMessage) {
    const welcomeMessage = config.additional.groups.welcomeMessage
      .replace('{mention}', `@${event.participants[0].split('@')[0]}`)
      .replace('{group}', event.subject);
    await sock.sendMessage(event.jid, { text: welcomeMessage, mentions: event.participants });
  }
};
