import fs from "fs";
import path from "path";
import config from "../config.js";

export default {
  name: "media",

  async onMessage(sock, message, ctx) {
    const msg = message.message;
    if (!msg) return;

    let type, media;

    if (msg.imageMessage) {
      type = "image";
      media = msg.imageMessage;
    } else if (msg.videoMessage) {
      type = "video";
      media = msg.videoMessage;
    } else if (msg.audioMessage) {
      type = "audio";
      media = msg.audioMessage;
    } else if (msg.stickerMessage) {
      type = "sticker";
      media = msg.stickerMessage;
    }

    if (!type) return;

    /* ===== VIEW ONCE ===== */
    if (msg.viewOnceMessageV2 || msg.viewOnceMessageV2Extension) {
      if (config.media?.blockViewOnce) {
        await sock.sendMessage(
          ctx.chat,
          { text: "🚫 View-once media is disabled." },
          { quoted: message }
        );
        return false;
      }
    }

    /* ===== MEDIA BLOCK ===== */
    if (config.media?.blockMedia) {
      await sock.sendMessage(
        ctx.chat,
        { text: "🚫 Media messages are disabled." },
        { quoted: message }
      );
      return false;
    }

    /* ===== SIZE LIMIT ===== */
    const max = config.media?.sizeLimits?.[type];
    if (max && media.fileLength && Number(media.fileLength) > max) {
      await sock.sendMessage(
        ctx.chat,
        {
          text:
`🚫 ${type.toUpperCase()} TOO LARGE
Size: ${(media.fileLength / 1024 / 1024).toFixed(2)} MB
Limit: ${(max / 1024 / 1024).toFixed(2)} MB`
        },
        { quoted: message }
      );
      return false;
    }

    /* ===== AUTO SAVE ===== */
    if (config.media?.autoSave) {
      await saveMedia(sock, message, type);
    }
  }
};

async function saveMedia(sock, message, type) {
  const buffer = await sock.downloadMediaMessage(message);
  if (!buffer) return;

  const dir = path.resolve("data/media", type);
  fs.mkdirSync(dir, { recursive: true });

  const ext = {
    image: "jpg",
    video: "mp4",
    audio: "mp3",
    sticker: "webp"
  }[type] || "bin";

  const file = `${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(dir, file), buffer);
}
