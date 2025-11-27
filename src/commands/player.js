const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');
const { createErrorEmbed, createPlayerStatsEmbed } = require('../utils/embeds');

const command = new SlashCommandBuilder()
  .setName('player')
  .setDescription('Player management commands')
  .addSubcommand(subcommand =>
    subcommand
      .setName('info')
      .setDescription('Show player stats')
      .addUserOption(option =>
        option.setName('player')
          .setDescription('Player to show info for')
          .setRequired(true)));

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'info') {
    return handleInfo(interaction);
  }
}

async function handleInfo(interaction) {
  const playerUser = interaction.options.getUser('player');
  const player = db.getPlayer.get(playerUser.id);

  if (!player) {
    db.createOrUpdatePlayer.run(playerUser.id, playerUser.username);
    const newPlayer = db.getPlayer.get(playerUser.id);
    const member = await interaction.guild.members.fetch(playerUser.id).catch(() => null);
    return interaction.reply({ embeds: [createPlayerStatsEmbed(newPlayer, member)] });
  }

  const member = await interaction.guild.members.fetch(playerUser.id).catch(() => null);
  return interaction.reply({ embeds: [createPlayerStatsEmbed(player, member)] });
}

module.exports = { command, execute };
