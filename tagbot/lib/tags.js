'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_MAX = 5;

function normalizeHost(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
}

function empty() {
  return { version: 1, byHost: {} };
}

function loadTags(file) {
  try {
    if (!fs.existsSync(file)) return empty();
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || typeof raw !== 'object' || !raw.byHost) return empty();
    return { version: 1, byHost: raw.byHost };
  } catch {
    return empty();
  }
}

function saveTags(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function hostsOfUser(state, userId) {
  const id = String(userId);
  const out = [];
  for (const [host, watchers] of Object.entries(state.byHost)) {
    if ((watchers || []).some((w) => w.id === id)) out.push(host);
  }
  return out.sort();
}

function watchersOf(state, host) {
  const key = normalizeHost(host);
  return [...(state.byHost[key] || [])];
}

function mentionIds(state, host) {
  return watchersOf(state, host).map((w) => w.id);
}

/**
 * @param {object} opts
 * @param {string} opts.file
 * @param {string} opts.host — canonical hostname from the public API dump
 * @param {string} opts.userId
 * @param {string} [opts.userName]
 * @param {number} [opts.maxHosts]
 */
function claim(opts) {
  const file = opts.file;
  const host = normalizeHost(opts.host);
  const userId = String(opts.userId);
  const userName = String(opts.userName || '').slice(0, 64);
  const maxHosts = Math.max(1, Math.floor(opts.maxHosts || DEFAULT_MAX));
  if (!host) return { ok: false, code: 'bad_host', error: 'Missing hostname.' };

  const state = loadTags(file);
  const mine = hostsOfUser(state, userId);
  const list = state.byHost[host] || [];
  if (list.some((w) => w.id === userId)) {
    return { ok: true, code: 'already', host, hosts: mine };
  }
  if (mine.length >= maxHosts) {
    return {
      ok: false,
      code: 'limit',
      error: `Limit is ${maxHosts} hosts per Discord account.`,
      hosts: mine,
    };
  }

  state.byHost[host] = [
    ...list,
    { id: userId, name: userName || null, at: new Date().toISOString() },
  ];
  saveTags(file, state);
  return { ok: true, code: 'claimed', host, hosts: hostsOfUser(state, userId) };
}

function untag(opts) {
  const file = opts.file;
  const host = normalizeHost(opts.host);
  const userId = String(opts.userId);
  if (!host) return { ok: false, code: 'bad_host', error: 'Missing hostname.' };

  const state = loadTags(file);
  const list = state.byHost[host] || [];
  if (!list.some((w) => w.id === userId)) {
    return { ok: false, code: 'missing', error: `You are not tagged for \`${host}\`.` };
  }
  const next = list.filter((w) => w.id !== userId);
  if (next.length) state.byHost[host] = next;
  else delete state.byHost[host];
  saveTags(file, state);
  return { ok: true, code: 'untagged', host, hosts: hostsOfUser(state, userId) };
}

module.exports = {
  DEFAULT_MAX,
  normalizeHost,
  loadTags,
  saveTags,
  hostsOfUser,
  watchersOf,
  mentionIds,
  claim,
  untag,
  empty,
};
