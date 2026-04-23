import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function downloadMedia({
  sock,
  chat,
  quoted,
  downloadUrl,
  type,
  fileName,
  caption
}) {
  const cacheDir = path.join(__dirname, "cache");
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const filePath = path.join(cacheDir, fileName);

  try {
    const res = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      timeout: 0,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "*/*"
      }
    });

    fs.writeFileSync(filePath, res.data);

    if (type === "audio") {
      await sock.sendMessage(
        chat,
        {
          audio: fs.readFileSync(filePath),
          mimetype: "audio/mp4",
          fileName,
          ptt: false,
          caption
        },
        { quoted }
      );
    } else {
      await sock.sendMessage(
        chat,
        {
          video: fs.readFileSync(filePath),
          mimetype: "video/mp4",
          fileName,
          caption
        },
        { quoted }
      );
    }

  } catch (err) {
    console.error("Media downloader error:", err?.response?.status || err);
    await sock.sendMessage(
      chat,
      { text: "❌ Media download failed (provider error)." },
      { quoted }
    );
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
