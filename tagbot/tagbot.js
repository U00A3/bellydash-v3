'use strict';

// Under systemd stdout is not a TTY — without this, logs stay buffered.
if (process.stdout._handle && typeof process.stdout._handle.setBlocking === 'function') {
  process.stdout._handle.setBlocking(true);
}
if (process.stderr._handle && typeof process.stderr._handle.setBlocking === 'function') {
  process.stderr._handle.setBlocking(true);
}

/**
 * Discord bot: opt-in pings for node alerts.
 *
 * On a guild (recommended): /tagme /untag /tags
 * Replies are ephemeral — only the caller sees them.
 *
 * Optional DM (User Install). Text in DM needs ALERTER_TAGBOT_MESSAGE_CONTENT=1
 * plus Message Content Intent in the developer portal.
 *
 *   node tagbot.js
 *   node tagbot.js --register
 */

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  MessageFlags,
  InteractionContextType,
  ApplicationIntegrationType,
  ChannelType,
} = require('discord.js');
const { config } = require('./lib/env');
const {
  claim,
  untag,
  hostsOfUser,
  loadTags,
  normalizeHost,
} = require('./lib/tags');

const UA = 'bellydash-v3-tagbot/0.1';

const HELP =
  '**Bellydash tag bot** — DM only\n' +
  '• `/tagme host:` — get pinged on alerts (max 5)\n' +
  '• `/untag host:` — stop\n' +
  '• `/tags` — your list\n' +
  'If Discord asks to add the app: Install Link → **Add to My Apps**, then try again.';

function cmd(name, description, withHost) {
  const b = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setDMPermission(true)
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    )
    .setIntegrationTypes(
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    );
  if (withHost) {
    b.addStringOption((o) =>
      o.setName('host').setDescription('Node hostname, e.g. mynode.example').setRequired(true),
    );
  }
  return b;
}

const COMMANDS = [
  cmd('tagme', 'Ping me when this Bellydash node alerts', true),
  cmd('untag', 'Stop pings for this node', true),
  cmd('tags', 'List nodes you are tagged for', false),
].map((c) => c.toJSON());

async function resolveHost(apiUrl, raw) {
  const want = normalizeHost(raw);
  if (!want) return { ok: false, error: 'Missing hostname.' };
  const res = await fetch(apiUrl, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`api ${res.status}`);
  const json = await res.json();
  const nodes = Array.isArray(json.nodes) ? json.nodes : [];
  const hit = nodes.find((n) => normalizeHost(n.host) === want);
  if (!hit) {
    return {
      ok: false,
      error: `\`${want}\` is not on the public fleet list. Check the spelling on mynode.uk.`,
    };
  }
  return { ok: true, host: hit.host };
}

function listText(hosts, max) {
  if (!hosts.length) return `None yet. Use \`/tagme\` (max ${max}).`;
  return hosts.map((h) => `• \`${h}\``).join('\n') + `\n_(${hosts.length}/${max})_`;
}

async function doTags(cfg, userId) {
  const hosts = hostsOfUser(loadTags(cfg.tagsFile), userId);
  return `**Your tags**\n${listText(hosts, cfg.tagMaxHosts)}`;
}

async function doTagme(cfg, userId, userName, rawHost) {
  const found = await resolveHost(cfg.apiUrl, rawHost);
  if (!found.ok) return found.error;
  const result = claim({
    file: cfg.tagsFile,
    host: found.host,
    userId,
    userName,
    maxHosts: cfg.tagMaxHosts,
  });
  if (!result.ok) {
    return `${result.error}\n${listText(result.hosts || [], cfg.tagMaxHosts)}`;
  }
  const msg =
    result.code === 'already'
      ? `Already tagged for \`${result.host}\`.`
      : `Tagged for \`${result.host}\`. Alerts for this node will ping you.`;
  return `${msg}\n${listText(result.hosts, cfg.tagMaxHosts)}`;
}

async function doUntag(cfg, userId, rawHost) {
  const host = normalizeHost(rawHost);
  const result = untag({ file: cfg.tagsFile, host, userId });
  if (!result.ok) return result.error;
  return `Removed \`${result.host}\`.\n${listText(result.hosts, cfg.tagMaxHosts)}`;
}

async function registerCommands(cfg) {
  const rest = new REST({ version: '10' }).setToken(cfg.discordBotToken);
  await rest.put(Routes.applicationCommands(cfg.discordClientId), { body: COMMANDS });
  console.log('[tagbot] global commands registered');
  if (cfg.discordGuildId) {
    await rest.put(Routes.applicationGuildCommands(cfg.discordClientId, cfg.discordGuildId), {
      body: COMMANDS,
    });
    console.log(`[tagbot] guild commands → ${cfg.discordGuildId}`);
  }
}

async function onInteraction(interaction, cfg) {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const userName = interaction.user.username;

  try {
    if (interaction.commandName === 'tags') {
      await interaction.reply({
        content: await doTags(cfg, userId),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.commandName === 'tagme') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const raw = interaction.options.getString('host', true);
      await interaction.editReply(await doTagme(cfg, userId, userName, raw));
      return;
    }

    if (interaction.commandName === 'untag') {
      const raw = interaction.options.getString('host', true);
      await interaction.reply({
        content: await doUntag(cfg, userId, raw),
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (err) {
    console.error('[tagbot]', err.message || err);
    const text = 'Something went wrong. Try again in a minute.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(text).catch(() => {});
    } else {
      await interaction.reply({ content: text, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
}

async function resolveModChannels(cfg) {
  const ids = new Set(cfg.tagModChannelIds || []);
  if (ids.size || !cfg.webhook) return ids;
  try {
    const res = await fetch(cfg.webhook, { headers: { 'user-agent': UA } });
    if (!res.ok) return ids;
    const j = await res.json();
    if (j.channel_id) ids.add(String(j.channel_id));
  } catch (err) {
    console.error('[tagbot] webhook channel lookup', err.message || err);
  }
  return ids;
}

/** Plain chat on the alerts channel → delete. Slash / webhook / bots stay. */
async function onModChannelMessage(message, modChannels) {
  if (!modChannels.has(message.channel.id)) return;
  if (message.author?.bot || message.webhookId) return;
  if (message.channel.type !== ChannelType.GuildText && message.channel.type !== ChannelType.GuildAnnouncement) {
    return;
  }
  try {
    await message.delete();
  } catch (err) {
    console.error('[tagbot] delete', message.channel.id, err.message || err);
  }
}

async function onMessage(message, cfg, modChannels) {
  if (modChannels && modChannels.size) {
    await onModChannelMessage(message, modChannels);
  }

  if (message.author.bot) return;
  if (message.channel.type !== ChannelType.DM) return;

  const text = String(message.content || '').trim();
  if (!text) return;

  const lower = text.toLowerCase();
  const userId = message.author.id;
  const userName = message.author.username;

  try {
    if (lower === 'help' || lower === '?' || lower === 'hi' || lower === 'hello') {
      await message.reply(HELP);
      return;
    }

    if (lower === 'tags' || lower === '/tags') {
      await message.reply(await doTags(cfg, userId));
      return;
    }

    let m = text.match(/^(?:\/)?tagme\s+(\S+)/i);
    if (m) {
      await message.reply(await doTagme(cfg, userId, userName, m[1]));
      return;
    }

    m = text.match(/^(?:\/)?untag\s+(\S+)/i);
    if (m) {
      await message.reply(await doUntag(cfg, userId, m[1]));
      return;
    }

    await message.reply(HELP);
  } catch (err) {
    console.error('[tagbot] dm', err.message || err);
    await message.reply('Something went wrong. Try again in a minute.').catch(() => {});
  }
}

async function main() {
  const args = process.argv.slice(2);
  const cfg = config();
  if (!cfg.discordBotToken || !cfg.discordClientId) {
    console.error(
      '[tagbot] set ALERTER_DISCORD_BOT_TOKEN and ALERTER_DISCORD_CLIENT_ID in alerter/.env',
    );
    process.exit(1);
  }

  if (args.includes('--register')) {
    await registerCommands(cfg);
    return;
  }

  await registerCommands(cfg);

  const wantText = process.env.ALERTER_TAGBOT_MESSAGE_CONTENT === '1';
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ];
  // Message Content is not needed to delete chat — only for text DMs.
  if (wantText) intents.push(GatewayIntentBits.MessageContent);

  const modChannels = await resolveModChannels(cfg);

  const client = new Client({
    intents,
    partials: [Partials.Channel, Partials.Message],
  });

  client.once('ready', () => {
    console.log(
      `[tagbot] logged in as ${client.user.tag}; tags=${cfg.tagsFile}; max=${cfg.tagMaxHosts}` +
        (modChannels.size ? `; mod-channels=${[...modChannels].join(',')}` : '; mod-channels=none') +
        (wantText ? '; text-dm' : ''),
    );
  });

  client.on('interactionCreate', (i) => onInteraction(i, cfg));
  client.on('messageCreate', (m) => onMessage(m, cfg, modChannels));

  await client.login(cfg.discordBotToken);
}

main().catch((err) => {
  console.error('[tagbot]', err);
  process.exit(1);
});
