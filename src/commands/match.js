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
      .addRoleOption(option =>
        option.setName('home')
          .setDescription('Home team role')
          .setRequired(true))
      .addRoleOption(option =>
        option.setName('away')
          .setDescription('Away team role')
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
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('setmatchchannel')
      .setDescription('Set the channel for match announcements (Admin only)')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Channel for match shouts')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('shout')
      .setDescription('Announce a match in the match channel')
      .addIntegerOption(option =>
        option.setName('match_id')
          .setDescription('Match ID to announce')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('link')
          .setDescription('Link to the match (stream, ticket, etc)')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all unplayed matches (Admin & Referee only)'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('done')
      .setDescription('Mark a match as done and delete it (Admin & Referee only)')
      .addIntegerOption(option =>
        option.setName('match_id')
          .setDescription('Match ID to mark as done')
          .setRequired(true)));

async function handleCreate(interaction) {
  if (!isAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only administrators can create matches.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const homeRole = interaction.options.getRole('home');
  const awayRole = interaction.options.getRole('away');
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

  const homeTeam = db.getTeamByRoleId.get(homeRole.id);
  const awayTeam = db.getTeamByRoleId.get(awayRole.id);

  if (!homeTeam || !awayTeam) {
    const errorEmbed = createErrorEmbed('Team Not Found', 'One or both team roles do not correspond to existing teams.');
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
  if (!isAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only administrators can edit matches.');
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
  if (!isAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only administrators can cancel matches.');
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
  if (!isAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only administrators can reschedule matches.');
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

async function handleSetMatchChannel(interaction) {
  if (!isAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only administrators can set the match channel.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const channel = interaction.options.getChannel('channel');

  try {
    db.setSetting.run('match_channel', channel.id);
    const successEmbed = createSuccessEmbed('Match Channel Set', `Match announcements will now be posted in ${channel}.`);
    return interaction.reply({ embeds: [successEmbed], ephemeral: true });
  } catch (error) {
    console.error('Error setting match channel:', error);
    const errorEmbed = createErrorEmbed('Error', 'Failed to set match channel.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleShout(interaction) {
  if (!isRefereeOrAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only admins and referees can announce matches.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const matchId = interaction.options.getInteger('match_id');
  const link = interaction.options.getString('link');

  const match = db.getMatch.get(matchId);
  if (!match) {
    const errorEmbed = createErrorEmbed('Match Not Found', 'No match with that ID exists.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const matchChannelSetting = db.getSetting.get('match_channel');
  if (!matchChannelSetting) {
    const errorEmbed = createErrorEmbed('Error', 'Match channel has not been set. An admin must use `/match setmatchchannel` first.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  try {
    const channel = await interaction.client.channels.fetch(matchChannelSetting.value);
    if (!channel) {
      const errorEmbed = createErrorEmbed('Error', 'Match channel not found.');
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    const homeTeam = db.getTeamById.get(match.home_team_id);
    const awayTeam = db.getTeamById.get(match.away_team_id);

    const announcement = `# <@&${homeTeam.role_id}> VS <@&${awayTeam.role_id}>\n\n🏟️ **${match.stadium}**\n\n${link}`;
    
    await channel.send(announcement);

    const successEmbed = createSuccessEmbed('Match Announced', `Match has been announced in <#${matchChannelSetting.value}>.`);
    return interaction.reply({ embeds: [successEmbed], ephemeral: true });
  } catch (error) {
    console.error('Error announcing match:', error);
    const errorEmbed = createErrorEmbed('Error', `Failed to announce match: ${error.message}`);
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleList(interaction) {
  if (!isRefereeOrAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only admins and referees can list matches.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const matches = db.getUnplayedMatches.all();
  
  if (!Array.isArray(matches) || matches.length === 0) {
    const errorEmbed = createErrorEmbed('No Matches', 'There are no unplayed matches.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const { unixToTimestamp } = require('../utils/timestamps');
  const matchList = matches.map(m => 
    `**ID: ${m.id}** - <@&${m.home_team_role_id}> vs <@&${m.away_team_role_id}>\n🕐 ${unixToTimestamp(m.match_timestamp)} | 🏟️ ${m.stadium}`
  ).join('\n\n');

  const embed = new (require('discord.js')).EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('📋 Unplayed Matches')
    .setDescription(matchList)
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDone(interaction) {
  if (!isRefereeOrAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only admins and referees can mark matches as done.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const matchId = interaction.options.getInteger('match_id');
  
  if (!Number.isInteger(matchId) || matchId <= 0) {
    const errorEmbed = createErrorEmbed('Invalid ID', 'Match ID must be a positive integer.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const match = db.getMatch.get(matchId);

  if (!match) {
    const errorEmbed = createErrorEmbed('Match Not Found', 'No match with that ID exists.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  try {
    db.deleteMatch.run(matchId);
    const successEmbed = createSuccessEmbed('Match Completed', 
      `Match **${match.home_team_name}** vs **${match.away_team_name}** has been marked as done and removed from the database.`);
    return interaction.reply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error marking match as done:', error);
    const errorEmbed = createErrorEmbed('Error', 'Failed to mark match as done.');
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
    case 'setmatchchannel':
      return handleSetMatchChannel(interaction);
    case 'shout':
      return handleShout(interaction);
    case 'list':
      return handleList(interaction);
    case 'done':
      return handleDone(interaction);
  }
}

module.exports = {
  command,
  execute
};
