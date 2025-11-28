const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { isAdmin, isRefereeOrAdmin } = require('../utils/permissions');
const { dateTimeToUnix, unixToTimestamp } = require('../utils/timestamps');

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
    const matchTimestamp = dateTimeToUnix(date, time);
    const result = db.createMatch.run(homeTeam.id, awayTeam.id, stadium, matchTimestamp);
    const matchId = result.lastInsertRowid;
    const successEmbed = createSuccessEmbed('Match Created', 
      `<@&${homeTeam.role_id}> ⚽ <@&${awayTeam.role_id}>\n` +
      `🏟️ Stadium: ${stadium}\n🕐 Time: ${unixToTimestamp(matchTimestamp)}\n\n` +
      `**Match ID:** ${matchId}`);
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
  let matchTimestamp = match.match_timestamp;

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
    // Extract time from current timestamp and combine with new date
    const currentDate = new Date(matchTimestamp * 1000);
    const hours = String(currentDate.getUTCHours()).padStart(2, '0');
    const minutes = String(currentDate.getUTCMinutes()).padStart(2, '0');
    matchTimestamp = dateTimeToUnix(value, `${hours}:${minutes}`);
  } else if (field === 'time') {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      const errorEmbed = createErrorEmbed('Invalid Time', 'Time must be in HH:MM format.');
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
    // Extract date from current timestamp and combine with new time
    const currentDate = new Date(matchTimestamp * 1000);
    const year = currentDate.getUTCFullYear();
    const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getUTCDate()).padStart(2, '0');
    matchTimestamp = dateTimeToUnix(`${year}-${month}-${day}`, value);
  }

  if (homeTeamId === awayTeamId) {
    const errorEmbed = createErrorEmbed('Invalid Match', 'Home and away teams must be different.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  try {
    db.updateMatch.run(homeTeamId, awayTeamId, stadium, matchTimestamp, matchId);
    const updatedMatch = db.getMatch.get(matchId);
    // Get role IDs for the teams
    const homeTeam = db.getTeamById.get(homeTeamId);
    const awayTeam = db.getTeamById.get(awayTeamId);
    const successEmbed = createSuccessEmbed('Match Updated',
      `<@&${homeTeam.role_id}> ⚽ <@&${awayTeam.role_id}>\n` +
      `🏟️ Stadium: ${updatedMatch.stadium}\n🕐 Time: ${unixToTimestamp(updatedMatch.match_timestamp)}`);
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
    // Get role IDs for the teams
    const homeTeam = db.getTeamById.get(match.home_team_id);
    const awayTeam = db.getTeamById.get(match.away_team_id);
    const successEmbed = createSuccessEmbed('Match Cancelled',
      `<@&${homeTeam.role_id}> ⚽ <@&${awayTeam.role_id}>\n📍 Reason: ${reason}`);
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
    const newTimestamp = dateTimeToUnix(newDate, newTime);
    db.updateMatch.run(match.home_team_id, match.away_team_id, match.stadium, newTimestamp, matchId);
    // Get role IDs for the teams
    const homeTeam = db.getTeamById.get(match.home_team_id);
    const awayTeam = db.getTeamById.get(match.away_team_id);
    const successEmbed = createSuccessEmbed('Match Rescheduled',
      `<@&${homeTeam.role_id}> ⚽ <@&${awayTeam.role_id}>\n` +
      `🕐 New Time: ${unixToTimestamp(newTimestamp)}`);
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
