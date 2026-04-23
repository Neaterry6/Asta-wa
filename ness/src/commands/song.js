import axios from "axios";
import { setReplyCallback } from "../../handler/replyHandler.js";
import { downloadMedia } from "../../plugins/mediaDownloader.js";

function getSenderJid(message) {
  return (
    message.key.participantAlt ||
    message.key.participant ||
    message.key.remoteJid
  );
}

export default {
  config: {
    name: "sc",
    aliases: ["soundcloud"],
    description: "Search and download SoundCloud music",
    usage: ".sc faded",
    category: "media"
  },

  onRun: async (sock, message, args) => {
    if (!args.length)
      return message.reply("❌ Usage: .sc faded");

    const query = args.join(" ");
    console.log("[SC] SEARCH:", query);

    let api;
    try {
      api = await axios.get(
        "https://discardapi.dpdns.org/api/search/soundcloud",
        {
          params: { apikey: "guru", query },
          timeout: 20000
        }
      );
      console.log("[SC] SEARCH RESPONSE:", api.data);
    } catch (e) {
      console.error("[SC] SEARCH ERROR:", e.message);
      return message.reply("❌ SoundCloud search failed.");
    }

    const data = api.data?.result;
    if (!data?.status || !Array.isArray(data.result) || !data.result.length)
      return message.reply("❌ No results found.");

    const tracks = data.result.slice(0, 5);

    let text = `🎧 *SoundCloud Results*\n\n`;
    tracks.forEach((t, i) => {
 text += `${i + 1}️⃣ *${t.name || "Unknown"}*\n👤 ${t.artist || "Unknown"}\n\n`;;
    });
    text += `Reply with a number (1-${tracks.length})`;

    const sent = await sock.sendMessage(
      message.key.remoteJid,
      { text },
      { quoted: message }
    );

    const userJid = getSenderJid(message);

    setReplyCallback(sent.key.id, userJid, async (sock, replyMsg) => {
      const choiceText =
        replyMsg.message?.conversation ||
        replyMsg.message?.extendedTextMessage?.text;

      if (!choiceText) return;

      const index = Number(choiceText.trim());
      if (isNaN(index) || index < 1 || index > tracks.length)
        return replyMsg.reply("❌ Invalid number.");

      const track = tracks[index - 1];
      console.log("[SC] SELECTED:", track.name);
      console.log("[SC] URL:", track.url);

      await replyMsg.reply("🎶 Downloading from SoundCloud...");

      let dl;
      try {
        dl = await axios.get(
          "https://discardapi.dpdns.org/api/dl/soundcloud",
          {
            params: {
              apikey: "guru",
              url: track.url
            },
            timeout: 60000
          }
        );
        console.log("[SC] DL RESPONSE:", dl.data);
      } catch (e) {
        console.error("[SC] DL ERROR:", e.message);
        return replyMsg.reply("❌ Download failed.");
      }

      const downloadUrl = dl.data?.result?.download;
      if (!downloadUrl) {
        console.error("[SC] INVALID DL DATA:", dl.data);
        return replyMsg.reply("❌ Download failed.");
      }

      await downloadMedia({
        sock,
        chat: replyMsg.key.remoteJid,
        quoted: replyMsg,
        type: "audio",
        downloadUrl,
        fileName: `${track.name}.mp3`,
        mimetype: "audio/mpeg",
        caption: `🎵 ${track.name}`
      });

      console.log("[SC] AUDIO SENT ✔");
    });
  }
};