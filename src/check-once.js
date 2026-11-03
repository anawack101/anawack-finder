
require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { scrapeXboxSeries } = require("./scraper");

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const statePath = path.resolve(process.env.STATE_FILE || "./data/state.json");

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return { seen: [], initialized: false };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

async function sendDiscord(account) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Anawack Finder",
      embeds: [{
        title: "🆕 New Xbox Series AFK account",
        color: 0x2ecc71,
        fields: [
          { name: "Gamertag", value: `\`${account.gamertag}\``, inline: true },
          { name: "Website status", value: account.status || "Listed", inline: true },
          { name: "Platform", value: "Xbox Series X|S", inline: true }
        ],
        url: "https://gtaglitches.com/afk-accounts",
        footer: { text: "GTA Glitches • Community-submitted listing" },
        timestamp: new Date().toISOString()
      }]
    })
  });

  if (!response.ok) {
    throw new Error(`Discord webhook returned HTTP ${response.status}: ${await response.text()}`);
  }
}

async function main() {
  if (!webhookUrl) throw new Error("Missing DISCORD_WEBHOOK_URL secret.");

  const accounts = await scrapeXboxSeries();
  const state = readState();

  if (!state.initialized) {
    state.seen = accounts.map(a => a.gamertag.toLowerCase());
    state.initialized = true;
    state.lastCount = accounts.length;
    saveState(state);
    console.log(`Initial baseline saved: ${accounts.length} Xbox Series listings. No alerts sent.`);
    return;
  }

  const seen = new Set(state.seen || []);
  const fresh = accounts.filter(a => !seen.has(a.gamertag.toLowerCase()));

  for (const account of fresh) {
    await sendDiscord(account);
    console.log(`Alert sent for ${account.gamertag}`);
  }

  state.seen = [...new Set([...(state.seen || []), ...accounts.map(a => a.gamertag.toLowerCase())])];
  state.lastCount = accounts.length;
  state.lastCheckedAt = new Date().toISOString();
  saveState(state);
  console.log(`Checked ${accounts.length} accounts; ${fresh.length} new.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
