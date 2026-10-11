'use strict';

/**
 * Minimal env loader for TagMe (review / standalone copy).
 * Production Bellydash may load a larger alerter config; TagMe only needs these keys.
 */

const fs = require('fs');
const path = require('path');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function loadEnv() {
  const here = path.resolve(__dirname, '..');
  loadEnvFile(path.join(here, '.env'));
}

function num(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function config() {
  loadEnv();
  const dashUrl = (process.env.ALERTER_DASH_URL || 'https://mynode.uk').replace(/\/$/, '');
  return {
    webhook: (process.env.ALERTER_DISCORD_WEBHOOK_URL || '').trim(),
    apiUrl: process.env.ALERTER_API_URL || `${dashUrl}/api/v3/nodes`,
    dashUrl,
    tagsFile:
      process.env.ALERTER_TAGS_FILE ||
      path.join(__dirname, '..', 'data', 'tags.json'),
    tagMaxHosts: Math.max(1, Math.floor(num('ALERTER_TAG_MAX_HOSTS', 5))),
    discordBotToken: (process.env.ALERTER_DISCORD_BOT_TOKEN || '').trim(),
    discordClientId: (process.env.ALERTER_DISCORD_CLIENT_ID || '').trim(),
    discordGuildId: (process.env.ALERTER_DISCORD_GUILD_ID || '').trim(),
    /** Channels where TagMe deletes plain chat (slash stays). Empty = webhook channel. */
    tagModChannelIds: String(process.env.ALERTER_TAGBOT_MOD_CHANNEL_ID || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

module.exports = { config, loadEnv };
