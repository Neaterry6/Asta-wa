export default {
  "bot": {
    "name": "Asta Bot",
    "prefix": ".",
    "admins": [
      "2349139977668@s.whatsapp.net",
      "145917739024404@lid"
    ],
    "number": process.env.BOT_NUMBER || "",
    "status": "online"
  },
    "keys": {
    "gemini": process.env.GEMINI_API_KEY || ""
  },

  "qwen": {
    "baseUrl": process.env.QWEN_BASE_URL || "https://qwen.aikit.club",
    "apiKey": process.env.QWEN_API_KEY || "",
    "defaultModel": process.env.QWEN_DEFAULT_MODEL || "Qwen3.6-Plus",
    "assistantName": process.env.QWEN_ASSISTANT_NAME || "Terry"
  },

  "qwen": {
    "baseUrl": "https://qwen.aikit.club",
    "apiKey": "",
    "defaultModel": "Qwen3.6-Plus",
    "assistantName": "Terry"
  },
  "onlyAdminMode": {
    "enabled": false
  },
  "whitelist": {
    "enabled": false,
    "users": [],
    "groups": []
  },
  "restart": {
    "enabled": true,
    "time": "120"
  },
  "consoleEvents": true,
  "separate": {
    "sourceCodeOwner": "Asta/avril",
    "time": "",
    "password": "2qrDreTyfGd5Uhre",
    "cooldown": 400,
    "database": {
      "type": "sqlite",
      "url": "",
      "password": "",
      "collection": ""
    }
  },
  "additional": {
    "autoRespond": {
      "enabled": true,
      "messages": {
        "hello": "Hello! How can I assist you?",
      }
    },
    "commands": {
      "disabled": [],
      "aliases": {}
    },
    "groups": {
      "autoJoin": true,
      "welcomeMessage": "Welcome {mention} to {group}!"
    }
  },

  "media": {
  "autoSave": false,
  "blockMedia": false,
  "blockViewOnce": false,
  "notifyViewOnce": true,

  "sizeLimits": {
    "image": 5 * 1024 * 1024,    // 5 MB
    "video": 20 * 1024 * 1024,  // 20 MB
    "audio": 10 * 1024 * 1024,  // 10 MB
    "sticker": 1 * 1024 * 1024  // 1 MB
  },

  blockOversize: true
},


  "developer": {
    "debug": false,
    "logLevel": "info"
  }
};
