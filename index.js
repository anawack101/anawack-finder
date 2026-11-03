require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  ChannelType
} = require("discord.js");
const { scrapeXboxSeries } = require("./scraper");

const {
  DISCORD_TOKEN,
  POLL_MINUTES = "5",
  STATE_FILE = "./data/state.json"
} = process.env;

if (!DISCORD_TOKEN) {
  throw new Error("Missing DISCORD_TOKEN. Copy .env.example to .env and add your bot token.");
}

const pollMs = Math.max(1, Number(POLL_MINUTES) || 5) * 60 * 1000;
const statePath = path.resolve(STATE_FILE);
const stateDir = path.dirname(statePath);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let pollInProgress = false;
let lastCheckAt = null;
let lastError = null;
let lastCount = 0;
let latestDetected = [];

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return { channelId: null, seen: [], latest: [], initialized: false };
  }
}

let state = readState();

function saveState() {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function makeAccountEmbed(account, isNew = true) {
  const statusText = account.status
    ? account.status.charAt(0).toUpperCase() + account.status.slice(1)
    : "Listed";

  return new EmbedBuilder()
    .setColor(isNew ? 0x2ecc71 : 0x5865f2)
    .setTitle(isNew ? "🆕 New Xbox Series AFK account" : "Xbox Series AFK account")
    .addFields(
      { name: "Gamertag", value: `\`${account.gamertag}\``, inline: true },
      { name: "Website status", value: statusText, inline: true },
      { name: "Platform", value: "Xbox Series X|S", inline: true }
    )
    .setURL(account.source || "https://gtaglitches.com/afk-accounts")
    .setFooter({ text: "Source: GTA Glitches • Community-submitted listing" })
    .setTimestamp();
}

async function getAlertChannel() {
  if (!state.channelId) return null;
  const channel = await client.channels.fetch(state.channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.type === ChannelType.DM) return null;
  return channel;
}

async function runCheck({ announce = true } = {}) {
  if (pollInProgress) return { skipped: true };
  pollInProgress = true;

  try {
    const accounts = await scrapeXboxSeries();
    lastCheckAt = new Date();
    lastError = null;
    lastCount = accounts.length;

    const seen = new Set((state.seen || []).map(x => x.toLocaleLowerCase()));
    const newAccounts = accounts.filter(a => !seen.has(a.gamertag.toLocaleLowerCase()));

    // First successful run establishes a baseline and avoids flooding a
    // newly installed server with every old listing.
    if (!state.initialized) {
      state.seen = accounts.map(a => a.gamertag);
      state.latest = accounts.slice(0, 20);
      state.initialized = true;
      saveState();
      latestDetected = state.latest;
      console.log(`Baseline saved: ${accounts.length} Xbox Series accounts. No alerts sent.`);
      return { baseline: true, count: accounts.length, newCount: 0 };
    }

    if (newAccounts.length && announce) {
      const channel = await getAlertChannel();
      if (channel) {
        for (const account of newAccounts) {
          await channel.send({ embeds: [makeAccountEmbed(account, true)] });
        }
      } else {
        console.warn("New accounts found, but no alert channel is configured. Run /setup.");
      }
    }

    state.seen = [...new Set([...(state.seen || []), ...accounts.map(a => a.gamertag)])];
    state.latest = accounts.slice(0, 20);
    saveState();
    latestDetected = state.latest;

    console.log(`Checked ${accounts.length} accounts; ${newAccounts.length} new.`);
    return { count: accounts.length, newCount: newAccounts.length, accounts: newAccounts };
  } catch (error) {
    lastError = error.message || String(error);
    console.error("Website check failed:", lastError);
    return { error: lastError };
  } finally {
    pollInProgress = false;
  }
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  console.log(`Checking GTA Glitches every ${POLL_MINUTES} minute(s).`);

  await runCheck();
  setInterval(() => runCheck(), pollMs);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "setup") {
    const channel = interaction.options.getChannel("channel", true);
    state.channelId = channel.id;
    saveState();
    await interaction.reply({
      content: `✅ New Xbox Series gamertag alerts will be posted in ${channel}.`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "status") {
    const channel = await getAlertChannel();
    const embed = new EmbedBuilder()
      .setColor(lastError ? 0xe74c3c : 0x5865f2)
      .setTitle("Anawack Finder status")
      .addFields(
        { name: "Platform", value: "Xbox Series X|S", inline: true },
        { name: "Check interval", value: `${POLL_MINUTES} minutes`, inline: true },
        { name: "Accounts on last successful check", value: String(lastCount || 0), inline: true },
        { name: "Alert channel", value: channel ? `${channel}` : "Not configured — use /setup", inline: false },
        { name: "Last check", value: lastCheckAt ? `<t:${Math.floor(lastCheckAt.getTime() / 1000)}:R>` : "Not yet successful", inline: true },
        { name: "Scraper", value: lastError ? `Error: ${lastError.slice(0, 900)}` : "No current error", inline: false }
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (interaction.commandName === "latest") {
    const latest = state.latest || [];
    if (!latest.length) {
      await interaction.reply({ content: "No gamertags have been saved yet. Try /check in a moment.", ephemeral: true });
      return;
    }
    const description = latest.slice(0, 20).map((a, i) =>
      `**${i + 1}.** \`${a.gamertag}\` — ${a.status || "listed"}`
    ).join("\n");
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Latest Xbox Series AFK accounts")
      .setDescription(description)
      .setURL("https://gtaglitches.com/afk-accounts")
      .setFooter({ text: "Community-submitted listings; check the source before joining." });
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (interaction.commandName === "check") {
    await interaction.deferReply({ ephemeral: true });
    const result = await runCheck();
    if (result.error) {
      await interaction.editReply(`❌ The website check failed:\n\`${result.error.slice(0, 1500)}\``);
    } else if (result.baseline) {
      await interaction.editReply(`✅ First check complete. Saved a baseline of ${result.count} Xbox Series listings. New listings will trigger alerts from now on.`);
    } else {
      await interaction.editReply(`✅ Checked ${result.count} Xbox Series listings. New gamertags found: **${result.newCount}**.`);
    }
  }
});

client.login(DISCORD_TOKEN);
