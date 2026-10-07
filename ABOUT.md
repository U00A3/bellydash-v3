# About Bellydash

Bellydash is an independent, public **Redbelly node dashboard** at [mynode.uk](https://mynode.uk).

It is not an official Redbelly product. When Bellydash and an official Redbelly channel disagree (for example about the installer), the official channel wins.

## What it does

Bellydash **reads and displays** what can be seen of the public fleet and chain from the outside:

- Which known nodes answer, which are quiet, which are in the current governor set, which are jailed.
- Certificate health on the recovery port (expiry, mismatch).
- Chain rhythm, fees, and daily history (NetStat).
- Operator vesting lookup for a single reward address (read-only; no wallet connect to send funds).
- A stable link and hash for the current public mainnet installer release.

It does **not**:

- Run a validator or send transactions.
- Replace Redbelly Explorer or official status channels.
- Claim every number is second-fresh (the node list refreshes on the order of a minute).

## Public API

The same fleet picture as the website is available as JSON:

```http
GET https://mynode.uk/api/v3/nodes
```

No API key. Intended for bots and operator tools. Rate-limited and cache-friendly. Discord alerts use this public dump; they do not open a private tunnel into Redbelly infrastructure.

## Optional operator opt-in (separate from Discord)

Operators can attach richer metrics from their own machine (for example via Grafana Alloy) using a wallet signature on the node card. That path is optional and unrelated to the Discord webhook request in this repo.

## Discord alerts (this proposal)

When something important changes in the **public** view of a node (offline after confirmations, TLS expiry, jail / unjail, falling behind tip), Bellydash can notify a Discord channel. Details for administrators are in [DISCORD-ADMIN.md](./DISCORD-ADMIN.md).
