const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const { createSuccessEmbed, createErrorEmbed, createFixturesEmbed } = require('../utils/embeds');
const { isReferee } = require('../utils/permissions');

const command = new SlashCommandBuilder()
  .setName('fixtures')
  .setDescription('Manage match fixtures')
  .addSubcommand(subcommand =>
    subcommand
      .setName('post')
      .setDescription('Post all upcoming fixtures grouped by date'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a new fixture')
      .addUserOption(option =>
        option.setName('home_team')
          .setDescription('Home team')
          .setRequired(true))
      .addUserOption(option =>
        option.setName('away_team')
          .setDescription('Away team')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('kickoff')
          .setDescription('Kickoff time (YYYY-MM-DD HH:MM)')
          .setRequired(true)));

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'post':
      return handlePost(interaction);
    case 'add':
      return handleAdd(interaction);
  }
}

async function handlePost(interaction) {
  try {
    await interaction.deferReply();

    const fixtures = db.getUpcomingFixtures.all();

    if (fixtures.length === 0) {
      return interaction.editReply({
        embeds: [createErrorEmbed('No Fixtures', 'There are no upcoming fixtures scheduled.')]
      });
    }

    // Group fixtures by date
    const groupedByDate = {};
    fixtures.forEach(fixture => {
      const date = new Date(fixture.kickoff_time);
      const dateKey = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(fixture);
    });

    const embed = createFixturesEmbed(groupedByDate);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error posting fixtures:', error);
    return interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to post fixtures.')]
    });
  }
}

async function handleAdd(interaction) {
  if (!isReferee(interaction.member)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Permission Denied', 'Only referees can add fixtures.')],
      ephemeral: true
    });
  }

  try {
    const homeTeamUser = interaction.options.getUser('home_team');
    const awayTeamUser = interaction.options.getUser('away_team');
    const kickoffString = interaction.options.getString('kickoff');

    // Find teams by manager ID
    const homeTeam = db.getTeamByManagerId.get(homeTeamUser.id);
    const awayTeam = db.getTeamByManagerId.get(awayTeamUser.id);

    if (!homeTeam) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', `<@${homeTeamUser.id}> is not a team manager.`)],
        ephemeral: true
      });
    }

    if (!awayTeam) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', `<@${awayTeamUser.id}> is not a team manager.`)],
        ephemeral: true
      });
    }

    if (homeTeam.id === awayTeam.id) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'Home and away teams cannot be the same.')],
        ephemeral: true
      });
    }

    // Parse and validate kickoff time
    const kickoffDate = new Date(kickoffString);
    if (isNaN(kickoffDate.getTime())) {
      return interaction.reply({
        embeds: [createErrorEmbed('Invalid Time', 'Please use format: YYYY-MM-DD HH:MM')],
        ephemeral: true
      });
    }

    // Create fixture
    db.createFixture.run(homeTeam.id, awayTeam.id, kickoffDate.toISOString());

    return interaction.reply({
      embeds: [createSuccessEmbed(
        'Fixture Added',
        `**${homeTeam.name}** vs **${awayTeam.name}**\nKickoff: ${kickoffDate.toLocaleString()}`
      )],
      ephemeral: true
    });
  } catch (error) {
    console.error('Error adding fixture:', error);
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to add fixture.')],
      ephemeral: true
    });
  }
}

module.exports = { command, execute };
