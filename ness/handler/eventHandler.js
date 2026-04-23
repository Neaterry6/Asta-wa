import config from "../../config.js";
import log from "../../includes/log.js";

const events = {};

async function handleEvent(sock, event) {
  const eventName = event.type;
  if (events[eventName]) {
    try {
      await events[eventName](sock, event);
    } catch (error) {
      log.error(`Error running event ${eventName}:`, error);
    }
  }
}

function loadEvents() {
  const eventFiles = fs.readdirSync('./events');
  eventFiles.forEach((file) => {
    if (file.endsWith('.js')) {
      const eventName = file.replace('.js', '');
      events[eventName] = require(`./${file}`).default;
    }
  });
}

loadEvents();

export { handleEvent };
