# Anawack Finder — Xbox Series X|S Discord alerts

This bot checks https://gtaglitches.com/afk-accounts, selects the **Xbox Series** filter, and posts an alert in your chosen Discord text channel when it detects a gamertag it has not seen before.

## Important limitations

- The source website says its listings are community-submitted and presence updates approximately every 5–10 minutes.
- The bot checks the website every 5 minutes by default. It cannot make the source update faster.
- The first successful run saves the current list as a baseline and does **not** post every existing account. Only newly detected names after that baseline trigger alerts.
- The site renders its list dynamically. The included Playwright scraper tries to read account cards from the rendered page. If the site changes its HTML, `/status` and the terminal log will show a scraper error instead of inventing gamertags. The scraper selectors in `src/scraper.js` may then need adjusting.
- This bot reports newly listed names, not guaranteed working/online accounts. Check the source page before joining.

## 1. Install Node.js

Install Node.js 20 or newer: https://nodejs.org/

## 2. Create your Discord application

1. Open https://discord.com/developers/applications
2. Click **New Application** and give it a name, e.g. `Anawack Finder`.
3. Open **Bot** and click **Reset Token** / **Copy**. Keep this token private.
4. Open **General Information** and copy the **Application ID**.
5. You do not need Message Content, Server Members, or Presence privileged intents. This bot uses slash commands and only needs the `Guilds` intent.

## 3. Invite the bot to your server

In the Developer Portal:
1. Open **OAuth2 > URL Generator**.
2. Select scopes `bot` and `applications.commands`.
3. Select bot permissions `View Channels`, `Send Messages`, and `Embed Links`.
4. Copy the generated URL, open it, choose your server, and authorize.
5. You must have permission to manage the server to add the app.

Do not give the bot Administrator permission.

## 4. Configure the project

Unzip the downloaded folder. Open a terminal in that folder and run:

```bash
npm install
npx playwright install chromium
```

Copy `.env.example` to `.env` and fill in:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id
POLL_MINUTES=5
SOURCE_URL=https://gtaglitches.com/afk-accounts
STATE_FILE=./data/state.json
```

To copy your server ID in Discord, enable **User Settings > Advanced > Developer Mode**, then right-click / long-press the server icon and choose **Copy Server ID**.

Never share `.env` or your bot token. If the token leaks, reset it in the Developer Portal.

## 5. Register slash commands and start

Run these commands from the project folder:

```bash
npm run register
npm start
```

The bot should appear online. In your server, run:

```text
/setup
```

Choose the text channel where you want alerts.

Available commands:

- `/setup channel:#your-channel` — set the alert destination (Manage Server permission required).
- `/latest` — show the latest names the bot saved.
- `/status` — show monitoring and scraper status.
- `/check` — run a check immediately.

## 6. Keep it running

The bot only checks while the Node process is running. Keep your computer on, or deploy the folder to a Node.js hosting service / VPS that supports a persistent process and Playwright Chromium. Do not use a serverless host that stops background processes.

## Troubleshooting

### `/status` says it cannot find the Xbox Series filter
The source site's button text or page structure may have changed. Check the page manually, then update the button locator in `src/scraper.js`.

### `/status` says no account cards could be parsed
The site may have changed its rendered card markup. Open `src/scraper.js` and update `CARD_SELECTOR` and the extraction logic to match the current account cards. The scraper deliberately stops rather than guessing names from unrelated page text.

### The bot is online but slash commands do not appear
Run `npm run register` again. Check that `CLIENT_ID` and `GUILD_ID` are correct and that the bot was invited with the `applications.commands` scope.

### No alerts appear
The first successful check only creates the baseline. Alerts are sent only for names added after that. Also check `/status`, the terminal logs, and that the bot can send messages and embeds in the chosen channel.
