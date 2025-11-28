const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');
const { createSuccessEmbed, createErrorEmbed, createFixturesEmbed } = require('../utils/embeds');
const { isAdmin, isRefereeOrAdmin } = require('../utils/permissions');

const command = new SlashCommandBuilder()
  .setName('fixtures')
  .setDescription('Fixture posting commands')
  .addSubcommand(subcommand =>
    subcommand
      .setName('post')
      .setDescription('Post an embed of all upcoming matches grouped by date'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Delete the posted fixtures embed'));

async function handlePost(interaction) {
  if (!isRefereeOrAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only admins and referees can post fixtures.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  await interaction.deferReply();

  const matches = db.getAllUpcomingMatches.all();

  if (matches.length === 0) {
    const errorEmbed = createErrorEmbed('No Matches', 'There are no upcoming scheduled matches.');
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  const embed = createFixturesEmbed(matches);

  try {
    const message = await interaction.channel.send({ embeds: [embed] });
    
    // Update all matches to clear old fixtures message IDs and set the new one
    db.clearFixturesMessage.run();
    db.setFixturesMessage.run(message.id, matches[0].id);
    
    const successEmbed = createSuccessEmbed('Fixtures Posted', `Posted ${matches.length} upcoming match(es).`);
    return interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error posting fixtures:', error);
    const errorEmbed = createErrorEmbed('Error', 'Failed to post fixtures.');
    return interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleRemove(interaction) {
  if (!isRefereeOrAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only admins and referees can remove fixtures.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const fixturesData = db.getFixturesMessage.get();
    
    if (!fixturesData || !fixturesData.fixtures_message_id) {
      const errorEmbed = createErrorEmbed('No Fixtures', 'No fixtures message has been posted.');
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    try {
      const message = await interaction.channel.messages.fetch(fixturesData.fixtures_message_id);
      await message.delete();
    } catch (err) {
      // Message may have been deleted already
      console.log('Could not fetch message, but clearing from database anyway');
    }

    db.clearFixturesMessage.run();
    
    const successEmbed = createSuccessEmbed('Fixtures Removed', 'The fixtures embed has been deleted.');
    return interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error removing fixtures:', error);
    const errorEmbed = createErrorEmbed('Error', 'Failed to remove fixtures.');
    return interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'post':
      return handlePost(interaction);
    case 'remove':
      return handleRemove(interaction);
  }
}

module.exports = {
  command,
  execute
};
