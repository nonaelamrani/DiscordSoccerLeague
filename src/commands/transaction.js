const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { isAdmin } = require('../utils/permissions');

const command = new SlashCommandBuilder()
  .setName('transaction')
  .setDescription('Transaction window management')
  .addSubcommand(subcommand =>
    subcommand
      .setName('open')
      .setDescription('Open the transaction window (Admin only)'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('close')
      .setDescription('Close the transaction window (Admin only)'));

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'open':
      return handleOpenWindow(interaction);
    case 'close':
      return handleCloseWindow(interaction);
  }
}

async function handleOpenWindow(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can open the transaction window.')], ephemeral: true });
  }

  db.setSetting.run('transaction_window_open', 'true');
  return interaction.reply({ embeds: [createSuccessEmbed('Transaction Window Opened', 'Players can now demand at any time. Use `/transaction close` to close the window.')] });
}

async function handleCloseWindow(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can close the transaction window.')], ephemeral: true });
  }

  db.setSetting.run('transaction_window_open', 'false');
  return interaction.reply({ embeds: [createSuccessEmbed('Transaction Window Closed', 'Players can no longer demand. The 2-use limit applies again.')] });
}

module.exports = { command, execute };
