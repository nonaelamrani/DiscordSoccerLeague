const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');
const { isAdmin } = require('../utils/permissions');
const { createSuccessEmbed, createErrorEmbed, createRefereesEmbed } = require('../utils/embeds');

const command = new SlashCommandBuilder()
  .setName('referee')
  .setDescription('Referee management commands')
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Add a user as referee')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to set as referee')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove a referee')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to remove as referee')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all referees'));

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'set':
      return handleSet(interaction);
    case 'remove':
      return handleRemove(interaction);
    case 'list':
      return handleList(interaction);
  }
}

async function handleSet(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can set referees.')], ephemeral: true });
  }

  const user = interaction.options.getUser('user');

  if (user.bot) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Cannot set a bot as referee.')], ephemeral: true });
  }

  const existing = db.getReferee.get(user.id);
  if (existing) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'This user is already a referee.')], ephemeral: true });
  }

  db.addReferee.run(user.id);

  try {
    const member = await interaction.guild.members.fetch(user.id);
    const refereeRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'referee');
    if (refereeRole) {
      await member.roles.add(refereeRole.id);
    }
  } catch (error) {
    console.error('Error adding referee role:', error);
  }

  return interaction.reply({ embeds: [createSuccessEmbed('Referee Added', `<@${user.id}> is now a referee.`)] });
}

async function handleRemove(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can remove referees.')], ephemeral: true });
  }

  const user = interaction.options.getUser('user');

  const existing = db.getReferee.get(user.id);
  if (!existing) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'This user is not a referee.')], ephemeral: true });
  }

  db.removeReferee.run(user.id);

  try {
    const member = await interaction.guild.members.fetch(user.id);
    const refereeRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'referee');
    if (refereeRole) {
      await member.roles.remove(refereeRole.id);
    }
  } catch (error) {
    console.error('Error removing referee role:', error);
  }

  return interaction.reply({ embeds: [createSuccessEmbed('Referee Removed', `<@${user.id}> is no longer a referee.`)] });
}

async function handleList(interaction) {
  const referees = db.getAllReferees.all();
  return interaction.reply({ embeds: [createRefereesEmbed(referees)] });
}

module.exports = { command, execute };
