const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');
const { isAdmin, isRefereeOrAdmin } = require('../utils/permissions');
const { createSuccessEmbed, createErrorEmbed, createPlayerStatsEmbed, createTopScorersEmbed, createTopPlaymakersEmbed } = require('../utils/embeds');
const { logStatChange } = require('../utils/logger');

const command = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Statistics management commands')
  .addSubcommand(subcommand =>
    subcommand
      .setName('logchannel')
      .setDescription('Set the log channel for stat changes')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Channel to log stat changes')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('addgoal')
      .setDescription('Add goals to a player (Admin only)')
      .addUserOption(option =>
        option.setName('player')
          .setDescription('Player to add goals to')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('Number of goals to add')
          .setRequired(true)
          .setMinValue(1)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('removegoals')
      .setDescription('Remove goals from a player (Admin only)')
      .addUserOption(option =>
        option.setName('player')
          .setDescription('Player to remove goals from')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('Number of goals to remove')
          .setRequired(true)
          .setMinValue(1)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('addassist')
      .setDescription('Add assists to a player (Admin only)')
      .addUserOption(option =>
        option.setName('player')
          .setDescription('Player to add assists to')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('Number of assists to add')
          .setRequired(true)
          .setMinValue(1)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('removeassists')
      .setDescription('Remove assists from a player (Admin only)')
      .addUserOption(option =>
        option.setName('player')
          .setDescription('Player to remove assists from')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('Number of assists to remove')
          .setRequired(true)
          .setMinValue(1)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('addmention')
      .setDescription('Add a mention to players')
      .addUserOption(option =>
        option.setName('player1')
          .setDescription('First player')
          .setRequired(true))
      .addUserOption(option =>
        option.setName('player2')
          .setDescription('Second player')
          .setRequired(false))
      .addUserOption(option =>
        option.setName('player3')
          .setDescription('Third player')
          .setRequired(false))
      .addUserOption(option =>
        option.setName('player4')
          .setDescription('Fourth player')
          .setRequired(false))
      .addUserOption(option =>
        option.setName('player5')
          .setDescription('Fifth player')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('removemention')
      .setDescription('Remove a mention from a player')
      .addUserOption(option =>
        option.setName('player')
          .setDescription('Player to remove mention from')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('addmotm')
      .setDescription('Add MOTM to a player')
      .addUserOption(option =>
        option.setName('player')
          .setDescription('Player to add MOTM to')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('removemotm')
      .setDescription('Remove MOTM from a player')
      .addUserOption(option =>
        option.setName('player')
          .setDescription('Player to remove MOTM from')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('playerstats')
      .setDescription('Show player statistics')
      .addUserOption(option =>
        option.setName('player')
          .setDescription('Player to show stats for')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('topscorers')
      .setDescription('Show top scorers'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('topplayermakers')
      .setDescription('Show top playmakers (assists)'));

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'logchannel':
      return handleLogChannel(interaction);
    case 'addgoal':
      return handleAddGoal(interaction);
    case 'removegoals':
      return handleRemoveGoal(interaction);
    case 'addassist':
      return handleAddAssist(interaction);
    case 'removeassists':
      return handleRemoveAssist(interaction);
    case 'addmention':
      return handleAddMention(interaction);
    case 'removemention':
      return handleRemoveMention(interaction);
    case 'addmotm':
      return handleAddMotm(interaction);
    case 'removemotm':
      return handleRemoveMotm(interaction);
    case 'playerstats':
      return handlePlayerStats(interaction);
    case 'topscorers':
      return handleTopScorers(interaction);
    case 'topplayermakers':
      return handleTopPlaymakers(interaction);
  }
}

async function handleLogChannel(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can set the log channel.')], ephemeral: true });
  }

  const channel = interaction.options.getChannel('channel');
  db.setSetting.run('log_channel', channel.id);
  return interaction.reply({ embeds: [createSuccessEmbed('Log Channel Set', `Stat changes will now be logged in ${channel}.`)] });
}

async function handleAddGoal(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can add goals.')], ephemeral: true });
  }

  const playerUser = interaction.options.getUser('player');
  const amount = interaction.options.getInteger('amount');
  
  if (playerUser.bot) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Cannot add stats to bots.')], ephemeral: true });
  }

  db.createOrUpdatePlayer.run(playerUser.id, playerUser.username);
  const player = db.getPlayer.get(playerUser.id);
  
  const oldValue = player.goals;
  const newValue = player.goals + amount;
  db.updatePlayerStats.run(newValue, player.assists, player.mentions, player.motm, player.discord_id);

  await logStatChange(interaction.client, 'Goal Added', player, interaction.user.id, oldValue, newValue);
  return interaction.reply({ embeds: [createSuccessEmbed('Goals Added', `<@${playerUser.id}> now has **${newValue}** goals.`)] });
}

async function handleRemoveGoal(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can remove goals.')], ephemeral: true });
  }

  const playerUser = interaction.options.getUser('player');
  const amount = interaction.options.getInteger('amount');
  const player = db.getPlayer.get(playerUser.id);

  if (!player) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Player not found.')], ephemeral: true });
  }

  const oldValue = player.goals;
  const newValue = Math.max(0, player.goals - amount);
  db.updatePlayerStats.run(newValue, player.assists, player.mentions, player.motm, player.discord_id);

  await logStatChange(interaction.client, 'Goal Removed', player, interaction.user.id, oldValue, newValue);
  return interaction.reply({ embeds: [createSuccessEmbed('Goals Removed', `<@${playerUser.id}> now has **${newValue}** goals.`)] });
}

async function handleAddAssist(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can add assists.')], ephemeral: true });
  }

  const playerUser = interaction.options.getUser('player');
  const amount = interaction.options.getInteger('amount');
  
  if (playerUser.bot) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Cannot add stats to bots.')], ephemeral: true });
  }

  db.createOrUpdatePlayer.run(playerUser.id, playerUser.username);
  const player = db.getPlayer.get(playerUser.id);
  
  const oldValue = player.assists;
  const newValue = player.assists + amount;
  db.updatePlayerStats.run(player.goals, newValue, player.mentions, player.motm, player.discord_id);

  await logStatChange(interaction.client, 'Assist Added', player, interaction.user.id, oldValue, newValue);
  return interaction.reply({ embeds: [createSuccessEmbed('Assists Added', `<@${playerUser.id}> now has **${newValue}** assists.`)] });
}

async function handleRemoveAssist(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can remove assists.')], ephemeral: true });
  }

  const playerUser = interaction.options.getUser('player');
  const amount = interaction.options.getInteger('amount');
  const player = db.getPlayer.get(playerUser.id);

  if (!player) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Player not found.')], ephemeral: true });
  }

  const oldValue = player.assists;
  const newValue = Math.max(0, player.assists - amount);
  db.updatePlayerStats.run(player.goals, newValue, player.mentions, player.motm, player.discord_id);

  await logStatChange(interaction.client, 'Assist Removed', player, interaction.user.id, oldValue, newValue);
  return interaction.reply({ embeds: [createSuccessEmbed('Assists Removed', `<@${playerUser.id}> now has **${newValue}** assists.`)] });
}

async function handleAddMention(interaction) {
  if (!isRefereeOrAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only referees or administrators can modify stats.')], ephemeral: true });
  }

  const players = [];
  for (let i = 1; i <= 5; i++) {
    const player = interaction.options.getUser(`player${i}`);
    if (player) {
      if (player.bot) {
        return interaction.reply({ embeds: [createErrorEmbed('Error', 'Cannot add stats to bots.')], ephemeral: true });
      }
      players.push(player);
    }
  }

  const results = [];
  for (const playerUser of players) {
    db.createOrUpdatePlayer.run(playerUser.id, playerUser.username);
    const player = db.getPlayer.get(playerUser.id);
    
    const oldValue = player.mentions;
    const newValue = player.mentions + 1;
    db.updatePlayerStats.run(player.goals, player.assists, newValue, player.motm, player.discord_id);

    await logStatChange(interaction.client, 'Mention Added', player, interaction.user.id, oldValue, newValue);
    results.push(`<@${playerUser.id}> (${newValue} mentions)`);
  }

  return interaction.reply({ embeds: [createSuccessEmbed('Mentions Added', `Mentions added to:\n${results.join('\n')}`)] });
}

async function handleRemoveMention(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can remove mentions.')], ephemeral: true });
  }

  const playerUser = interaction.options.getUser('player');
  const player = db.getPlayer.get(playerUser.id);

  if (!player) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Player not found.')], ephemeral: true });
  }

  const oldValue = player.mentions;
  const newValue = Math.max(0, player.mentions - 1);
  db.updatePlayerStats.run(player.goals, player.assists, newValue, player.motm, player.discord_id);

  await logStatChange(interaction.client, 'Mention Removed', player, interaction.user.id, oldValue, newValue);
  return interaction.reply({ embeds: [createSuccessEmbed('Mention Removed', `<@${playerUser.id}> now has **${newValue}** mentions.`)] });
}

async function handleAddMotm(interaction) {
  if (!isRefereeOrAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only referees or administrators can modify stats.')], ephemeral: true });
  }

  const playerUser = interaction.options.getUser('player');
  
  if (playerUser.bot) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Cannot add stats to bots.')], ephemeral: true });
  }

  db.createOrUpdatePlayer.run(playerUser.id, playerUser.username);
  const player = db.getPlayer.get(playerUser.id);
  
  const oldValue = player.motm;
  const newValue = player.motm + 1;
  db.updatePlayerStats.run(player.goals, player.assists, player.mentions, newValue, player.discord_id);

  await logStatChange(interaction.client, 'MOTM Added', player, interaction.user.id, oldValue, newValue);
  return interaction.reply({ embeds: [createSuccessEmbed('MOTM Added', `<@${playerUser.id}> now has **${newValue}** MOTM awards.`)] });
}

async function handleRemoveMotm(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can remove MOTM.')], ephemeral: true });
  }

  const playerUser = interaction.options.getUser('player');
  const player = db.getPlayer.get(playerUser.id);

  if (!player) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Player not found.')], ephemeral: true });
  }

  const oldValue = player.motm;
  const newValue = Math.max(0, player.motm - 1);
  db.updatePlayerStats.run(player.goals, player.assists, player.mentions, newValue, player.discord_id);

  await logStatChange(interaction.client, 'MOTM Removed', player, interaction.user.id, oldValue, newValue);
  return interaction.reply({ embeds: [createSuccessEmbed('MOTM Removed', `<@${playerUser.id}> now has **${newValue}** MOTM awards.`)] });
}

async function handlePlayerStats(interaction) {
  const playerUser = interaction.options.getUser('player');
  
  if (playerUser.bot) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Cannot view stats for bots.')], ephemeral: true });
  }

  let player = db.getPlayer.get(playerUser.id);

  if (!player) {
    db.createOrUpdatePlayer.run(playerUser.id, playerUser.username);
    player = db.getPlayer.get(playerUser.id);
  }

  const member = await interaction.guild.members.fetch(playerUser.id).catch(() => null);
  return interaction.reply({ embeds: [createPlayerStatsEmbed(player, member)] });
}

async function handleTopScorers(interaction) {
  const players = db.getTopScorers.all();
  return interaction.reply({ embeds: [createTopScorersEmbed(players)] });
}

async function handleTopPlaymakers(interaction) {
  const players = db.getTopAssists.all();
  return interaction.reply({ embeds: [createTopPlaymakersEmbed(players)] });
}

module.exports = { command, execute };
