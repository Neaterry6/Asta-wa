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
name: "ytb",
aliases: ["ytsearch"],
description: "Search YouTube and download audio or video",
usage: ".ytb <song>",
category: "media"
},

onRun: async (sock, message, args) => {
if (!args.length)
return message.reply("❌ Usage: .ytb faded");

const query = args.join(" ");  
const searchUrl =  
  `https://noobs-api.top/dipto/ytFullSearch?songName=${encodeURIComponent(query)}`;  

let results;  
try {  
  const res = await axios.get(searchUrl, { timeout: 20000 });  
  results = res.data;  
} catch {  
  return message.reply("❌ Failed to search YouTube.");  
}  

if (!Array.isArray(results) || !results.length)  
  return message.reply("❌ No results found.");  

const video = results[0];  

const sent = await sock.sendMessage(  
  message.key.remoteJid,  
  {  
    image: { url: video.thumbnail },  
    caption:  
      `🎵 *${video.title}*\n` +  
      `👤 ${video.channel.name}\n` +  
      `⏱ ${video.time}\n\n` +  
      `Reply with:\n1️⃣ Audio\n2️⃣ Video`  
  },  
  { quoted: message }  
);  

const userJid = getSenderJid(message);  

setReplyCallback(sent.key.id, userJid, async (sock, replyMsg) => {  
  const text =  
    replyMsg.message?.conversation ||  
    replyMsg.message?.extendedTextMessage?.text;  

  if (!text) return;  

  const ytUrl = `https://www.youtube.com/watch?v=${video.id}`;  

  if (text.trim() === "1") {  
    await replyMsg.reply("🎧 Fetching audio...");  

    const info = await axios.get(  
      `https://meow-dl.onrender.com/yt?url=${encodeURIComponent(ytUrl)}&format=m4a`  
    );  

    if (info.data?.status !== "ok")  
      return replyMsg.reply("❌ Audio download failed.");  

    await downloadMedia({  
      sock,  
      chat: replyMsg.key.remoteJid,  
      quoted: replyMsg,  
      type: "audio",  
      downloadUrl: info.data.downloadLink,  
      fileName: `${info.data.title}.m4a`,  
      mimetype: "audio/mp4",  
      caption: `🎵 ${info.data.title}`  
    });  
  }  

  else if (text.trim() === "2") {  
    await replyMsg.reply("🎬 chill i'm coming...");  

    const info = await axios.get(  
      `https://meow-dl.onrender.com/yt?url=${encodeURIComponent(ytUrl)}&format=mp4&quality=480`  
    );  

    if (info.data?.status !== "ok")  
      return replyMsg.reply("❌ Video download failed.");  

    await downloadMedia({  
      sock,  
      chat: replyMsg.key.remoteJid,  
      quoted: replyMsg,  
      type: "video",  
      downloadUrl: info.data.downloadLink,  
      fileName: `${info.data.title}.mp4`,  
      mimetype: "video/mp4",  
      caption: `📺 ${info.data.title}`  
    });  
  }  

  else {  
    await replyMsg.reply("❌ Reply with 1 or 2 only.");  
  }  
});

}
};