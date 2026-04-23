// handler/replyHandler.js

const replyCallbacks = new Map();

/**
 * Register a reply callback for a specific message
 * @param {string} messageId - bot message key.id
 * @param {string} userJid
 * @param {Function} callback
 */
export function setReplyCallback(messageId, userJid, callback) {
  replyCallbacks.set(`${userJid}:${messageId}`, callback);

  // optional auto-clean after 2 minutes
  setTimeout(() => {
    replyCallbacks.delete(`${userJid}:${messageId}`);
  }, 120_000);
}

/**
 * Handle reply safely (only when replying to a tracked message)
 */
 export async function handleReply(sock, message, senderJid) {
  const ctx = message.message?.extendedTextMessage?.contextInfo;
  if (!ctx?.stanzaId) return false;

  const key = `${senderJid}:${ctx.stanzaId}`;
  const callback = replyCallbacks.get(key);

  // 🔐 HARD GUARD
  if (typeof callback !== "function") {
    replyCallbacks.delete(key);
    return false;
  }

  try {
    await callback(sock, message);
  } catch (err) {
    console.error("Reply callback error:", err);
  }

  replyCallbacks.delete(key);
  return true;
}
