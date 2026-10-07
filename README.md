# Bellydash Discord alerts (proposal)

Private documentation for Redbelly Discord administrators and Bellydash maintainers.

**Repository:** https://github.com/U00A3/bellydash-v3

**Live dashboard:** [https://mynode.uk](https://mynode.uk)  
**Public fleet API:** `GET https://mynode.uk/api/v3/nodes`

This repository contains **description and security notes only**. It does not contain bot tokens, webhook secrets, or application source code.

## Documents

| File | Audience |
|---|---|
| [ABOUT.md](./ABOUT.md) | What Bellydash is (read-only Redbelly node dashboard) |
| [DISCORD-ADMIN.md](./DISCORD-ADMIN.md) | How alerts and TagMe would work on the official Redbelly Discord; permissions; risks; screenshots |
| [pics/](./pics/) | Sample Discord embeds (welcome, down, back online, TLS, sync) and TagMe app profile |

## One-line summary

Bellydash can post **state-change alerts** for public Redbelly nodes into a **role-gated channel**, and a small bot can let operators **opt in to pings** for their hostname. The bot only needs **Manage Messages** on that channel so ordinary chat can be removed and the channel stays alert-focused.

## What we are asking for

1. A text channel visible only to a **node-operators** (or equivalent) role.
2. An **Incoming Webhook** on that channel (URL kept private, shared only with Bellydash ops).
3. An invite for a small bot (**TagMe**) with **View Channel**, **Use Application Commands**, and **Manage Messages** on that channel only.

No Administrator. No access to other channels. No privileged Discord intents. No requirement that operators install the app onto their Discord account.
