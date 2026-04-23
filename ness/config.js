export default {
  "bot": {
    "name": "Asta Bot",
    "prefix": ".",
    "admins": [
      "2349139977668@s.whatsapp.net",
      "145917739024404@lid"
    ],
    "number": "",
    "status": "online"
  },
    "keys": {
    "gemini": "AIzaSyClIFnL7w8J_issyCxLGOqXhgPZNVZ4Js4"
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
