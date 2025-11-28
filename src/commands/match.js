const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { isAdmin, isRefereeOrAdmin } = require('../utils/permissions');

const command = new SlashCommandBuilder()
  .setName('match')
  .setDescription('Match management commands')
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Create a new match')
      .addStringOption(option =>
        option.setName('home')
          .setDescription('Home team name')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('away')
          .setDescription('Away team name')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('stadium')
          .setDescription('Stadium name')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('date')
          .setDescription('Match date (YYYY-MM-DD)')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('time')
          .setDescription('Match time (HH:MM)')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Edit an existing match')
      .addIntegerOption(option =>
        option.setName('match_id')
          .setDescription('Match ID')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('field')
          .setDescription('Field to edit')
          .setRequired(true)
          .addChoices(
            { name: 'home', value: 'home' },
            { name: 'away', value: 'away' },
            { name: 'stadium', value: 'stadium' },
            { name: 'date', value: 'date' },
            { name: 'time', value: 'time' }))
      .addStringOption(option =>
        option.setName('value')
          .setDescription('New value')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('cancel')
      .setDescription('Cancel a scheduled match')
      .addIntegerOption(option =>
        option.setName('match_id')
          .setDescription('Match ID')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Cancellation reason')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('reschedule')
      .setDescription('Reschedule an existing match')
      .addIntegerOption(option =>
        option.setName('match_id')
          .setDescription('Match ID')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('new_date')
          .setDescription('New date (YYYY-MM-DD)')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('new_time')
          .setDescription('New time (HH:MM)')
          .setRequired(true)));

async function handleCreate(interaction) {
  if (!isRefereeOrAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only admins and referees can create matches.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const homeName = interaction.options.getString('home');
  const awayName = interaction.options.getString('away');
  const stadium = interaction.options.getString('stadium');
  const date = interaction.options.getString('date');
  const time = interaction.options.getString('time');

  // Validate date and time format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const errorEmbed = createErrorEmbed('Invalid Date', 'Date must be in YYYY-MM-DD format.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    const errorEmbed = createErrorEmbed('Invalid Time', 'Time must be in HH:MM format.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const homeTeam = db.getTeamByName.get(homeName);
  const awayTeam = db.getTeamByName.get(awayName);

  if (!homeTeam || !awayTeam) {
    const errorEmbed = createErrorEmbed('Team Not Found', 'One or both teams do not exist.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  if (homeTeam.id === awayTeam.id) {
    const errorEmbed = createErrorEmbed('Invalid Match', 'Home and away teams must be different.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  try {
    db.createMatch.run(homeTeam.id, awayTeam.id, stadium, date, time);
    const successEmbed = createSuccessEmbed('Match Created', 
      `**${homeTeam.name}** vs **${awayTeam.name}**\n` +
      `Stadium: ${stadium}\nDate: ${date}\nTime: ${time}`);
    return interaction.reply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error creating match:', error);
    const errorEmbed = createErrorEmbed('Error', 'Failed to create match.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleEdit(interaction) {
  if (!isRefereeOrAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only admins and referees can edit matches.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const matchId = interaction.options.getInteger('match_id');
  const field = interaction.options.getString('field');
  const value = interaction.options.getString('value');

  const match = db.getMatch.get(matchId);
  if (!match) {
    const errorEmbed = createErrorEmbed('Match Not Found', 'No match with that ID exists.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  let homeTeamId = match.home_team_id;
  let awayTeamId = match.away_team_id;
  let stadium = match.stadium;
  let matchDate = match.match_date;
  let matchTime = match.match_time;

  if (field === 'home') {
    const team = db.getTeamByName.get(value);
    if (!team) {
      const errorEmbed = createErrorEmbed('Team Not Found', 'Team does not exist.');
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
    homeTeamId = team.id;
  } else if (field === 'away') {
    const team = db.getTeamByName.get(value);
    if (!team) {
      const errorEmbed = createErrorEmbed('Team Not Found', 'Team does not exist.');
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
    awayTeamId = team.id;
  } else if (field === 'stadium') {
    stadium = value;
  } else if (field === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const errorEmbed = createErrorEmbed('Invalid Date', 'Date must be in YYYY-MM-DD format.');
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
    matchDate = value;
  } else if (field === 'time') {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      const errorEmbed = createErrorEmbed('Invalid Time', 'Time must be in HH:MM format.');
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
    matchTime = value;
  }

  if (homeTeamId === awayTeamId) {
    const errorEmbed = createErrorEmbed('Invalid Match', 'Home and away teams must be different.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  try {
    db.updateMatch.run(homeTeamId, awayTeamId, stadium, matchDate, matchTime, matchId);
    const updatedMatch = db.getMatch.get(matchId);
    const successEmbed = createSuccessEmbed('Match Updated',
      `**${updatedMatch.home_team_name}** vs **${updatedMatch.away_team_name}**\n` +
      `Stadium: ${updatedMatch.stadium}\nDate: ${updatedMatch.match_date}\nTime: ${updatedMatch.match_time}`);
    return interaction.reply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error updating match:', error);
    const errorEmbed = createErrorEmbed('Error', 'Failed to update match.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleCancel(interaction) {
  if (!isRefereeOrAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only admins and referees can cancel matches.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const matchId = interaction.options.getInteger('match_id');
  const reason = interaction.options.getString('reason');

  const match = db.getMatch.get(matchId);
  if (!match) {
    const errorEmbed = createErrorEmbed('Match Not Found', 'No match with that ID exists.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  if (match.status === 'cancelled') {
    const errorEmbed = createErrorEmbed('Already Cancelled', 'This match is already cancelled.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  try {
    db.cancelMatch.run(reason, matchId);
    const successEmbed = createSuccessEmbed('Match Cancelled',
      `**${match.home_team_name}** vs **${match.away_team_name}**\nReason: ${reason}`);
    return interaction.reply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error cancelling match:', error);
    const errorEmbed = createErrorEmbed('Error', 'Failed to cancel match.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleReschedule(interaction) {
  if (!isRefereeOrAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only admins and referees can reschedule matches.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const matchId = interaction.options.getInteger('match_id');
  const newDate = interaction.options.getString('new_date');
  const newTime = interaction.options.getString('new_time');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    const errorEmbed = createErrorEmbed('Invalid Date', 'Date must be in YYYY-MM-DD format.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
  if (!/^\d{2}:\d{2}$/.test(newTime)) {
    const errorEmbed = createErrorEmbed('Invalid Time', 'Time must be in HH:MM format.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const match = db.getMatch.get(matchId);
  if (!match) {
    const errorEmbed = createErrorEmbed('Match Not Found', 'No match with that ID exists.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  if (match.status === 'cancelled') {
    const errorEmbed = createErrorEmbed('Cancelled Match', 'Cannot reschedule a cancelled match.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  try {
    db.updateMatch.run(match.home_team_id, match.away_team_id, match.stadium, newDate, newTime, matchId);
    const successEmbed = createSuccessEmbed('Match Rescheduled',
      `**${match.home_team_name}** vs **${match.away_team_name}**\n` +
      `New Date: ${newDate}\nNew Time: ${newTime}`);
    return interaction.reply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error rescheduling match:', error);
    const errorEmbed = createErrorEmbed('Error', 'Failed to reschedule match.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'create':
      return handleCreate(interaction);
    case 'edit':
      return handleEdit(interaction);
    case 'cancel':
      return handleCancel(interaction);
    case 'reschedule':
      return handleReschedule(interaction);
  }
}

module.exports = {
  command,
  execute
};
