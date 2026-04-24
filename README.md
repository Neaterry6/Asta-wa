# Asta-wa Bot

WhatsApp bot with:
- pairing/session management
- multi-session support
- YouTube audio/video command
- Qwen model selection
- AI chat fallback flow

## Commands
- `.pair <number>`
- `.multipair <n1> <n2> ...`
- `.session status`
- `.session labels`
- `.session label <number> <name>`
- `.models`
- `.models set <name>`
- `.ytb -a <query|url>`
- `.ytb -v <query|url>`

## Notes
- Qwen model config lives in `data/qwen-model.json`
- session data lives in `cache/session-index.json`
