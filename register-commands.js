require("dotenv").config();
const { REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Choose the channel for new Xbox Series AFK account alerts")
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Text channel where alerts should be posted")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("latest")
    .setDescription("Show the newest Xbox Series gamertags the bot has detected"),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show the bot's monitoring status"),

  new SlashCommandBuilder()
    .setName("check")
    .setDescription("Check the GTA Glitches page now")
].map(command => command.toJSON());

async function main() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    throw new Error("Set DISCORD_TOKEN, CLIENT_ID and GUILD_ID in your .env file.");
  }

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log(`Registered ${commands.length} slash commands in guild ${GUILD_ID}.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
