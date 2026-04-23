import axios from "axios";

export default {
  config: {
    name: "pinterest",
    aliases: ["pin", "image", "img"],
    description: "Search and send Pinterest images",
    usage: ".pinterest <query> -<number>",
    category: "media"
  },

  onRun: async (sock, message, args) => {
    if (!args.length) {
      return message.reply("❌ Usage: .pinterest boy -5");
    }

    const text = args.join(" ");

    // extract number (-5)
    const numMatch = text.match(/-(\d+)/);
    let requested = numMatch ? parseInt(numMatch[1]) : 1;

    if (requested > 10) {
      return message.reply(`❌ You requested ${requested} images, but the maximum allowed is 10.`);
    }

    const limit = requested;

    // remove -number from query
    const query = text.replace(/-\d+/, "").trim();

    if (!query) {
      return message.reply("❌ Please provide a search keyword.");
    }

    const apiUrl = `https://meow-dl.onrender.com/pin?search=${encodeURIComponent(query)}`;

    let data;
    try {
      const res = await axios.get(apiUrl, { timeout: 20000 });
      data = res.data;
    } catch (err) {
      console.error("Pinterest API error:", err);
      return message.reply("❌ Failed to fetch Pinterest results.");
    }

    if (data.status !== "success" || !Array.isArray(data.results)) {
      return message.reply("❌ No results found.");
    }

    const images = data.results.slice(0, limit);

    if (!images.length) {
      return message.reply("❌ No images found.");
    }

    await message.reply(
      `📌 *Pinterest results for:* ${query}\n🖼 Sending ${images.length} image(s)...`
    );

    for (const img of images) {
      if (!img.image) continue;

      await sock.sendMessage(
        message.key.remoteJid,
        {
          image: { url: img.image },
        },
        { quoted: message }
      );
    }
  }
};
