# TagMe (source for review)

Small Discord bot used with Bellydash alerts. Operators opt in to pings for a hostname; plain chat on the alerts channel can be removed so the channel stays alert-focused.

This folder is the **reviewable source** of the bot that runs in production. It does **not** include tokens, webhooks, or live `tags.json` data.

## What it does

| Slash command | Behaviour |
|---|---|
| `/tagme host:` | Register the caller for pings on that public hostname (max 5 per Discord account) |
| `/untag host:` | Remove that registration |
| `/tags` | List the caller’s hosts |

Replies are **ephemeral** (only the caller sees them). Hostnames are checked against the public fleet API (`GET /api/v3/nodes`).

On configured channel(s): ordinary member messages are deleted; webhook posts, other bots, and slash interactions remain.

## Permissions (invite)

OAuth scopes: `bot` + `applications.commands`

Minimum on the alerts channel:

- View Channel
- Use Application Commands
- Manage Messages (chat cleanup only)

No Administrator. No privileged intents required for slash + delete (Message Content only if text DMs are enabled).

## Intents used

- `Guilds`
- `GuildMessages`
- `DirectMessages`
- optional `MessageContent` if `ALERTER_TAGBOT_MESSAGE_CONTENT=1`

## Files

| File | Role |
|---|---|
| `tagbot.js` | Slash commands, DM helper text, chat cleanup |
| `lib/tags.js` | Hostname → Discord user map on disk |
| `lib/env.js` | Minimal env loader for this standalone copy |
| `.env.example` | Keys only — no secrets |

Alert **embeds** are sent by a separate webhook alerter (not in this folder). TagMe only manages the opt-in map; the alerter reads that map when posting.

## Local run (optional)

```bash
cd tagbot
cp .env.example .env   # fill token + client id
npm install
node tagbot.js --register
node tagbot.js
```

Admin brief and screenshots: [../DISCORD-ADMIN.md](../DISCORD-ADMIN.md).
