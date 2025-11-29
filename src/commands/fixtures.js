const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');
const { createSuccessEmbed, createErrorEmbed, createFixturesEmbed, createFixturesDoneEmbed } = require('../utils/embeds');
const { isAdmin, isRefereeOrAdmin } = require('../utils/permissions');

const command = new SlashCommandBuilder()
  .setName('fixtures')
  .setDescription('Fixture posting commands')
  .addSubcommand(subcommand =>
    subcommand
      .setName('setchannel')
      .setDescription('Set the channel for posting fixtures (Admin only)')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Channel for fixtures')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('post')
      .setDescription('Post an embed of all upcoming matches grouped by date'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('done')
      .setDescription('Mark fixtures as done, archive them, and remove old matches'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Delete the posted fixtures embed'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('update')
      .setDescription('Update the fixtures embed with latest match changes'));

async function handleSetChannel(interaction) {
  if (!isAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only administrators can set the fixtures channel.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  const channel = interaction.options.getChannel('channel');

  try {
    db.setSetting.run('fixtures_channel', channel.id);
    const successEmbed = createSuccessEmbed('Fixtures Channel Set', `Fixtures will now be posted in ${channel}.`);
    return interaction.reply({ embeds: [successEmbed], ephemeral: true });
  } catch (error) {
    console.error('Error setting fixtures channel:', error);
    const errorEmbed = createErrorEmbed('Error', 'Failed to set fixtures channel.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handlePost(interaction) {
  if (!isAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only administrators can post fixtures.');
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
    const fixturesChannelSetting = db.getSetting.get('fixtures_channel');
    if (!fixturesChannelSetting) {
      const errorEmbed = createErrorEmbed('Error', 'Fixtures channel has not been set. An admin must use `/fixtures setchannel` first.');
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    const channel = await interaction.client.channels.fetch(fixturesChannelSetting.value);
    if (!channel) {
      const errorEmbed = createErrorEmbed('Error', 'Fixtures channel not found.');
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    const message = await channel.send({ embeds: [embed] });
    
    // Update all matches to clear old fixtures message IDs and set the new one
    db.clearFixturesMessage.run();
    db.setFixturesMessage.run(message.id, matches[0].id);
    
    const successEmbed = createSuccessEmbed('Fixtures Posted', `Posted ${matches.length} upcoming match(es) in <#${fixturesChannelSetting.value}>.`);
    return interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error posting fixtures:', error);
    const errorEmbed = createErrorEmbed('Error', `Failed to post fixtures: ${error.message}`);
    return interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleDone(interaction) {
  if (!isAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only administrators can mark fixtures as done.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const fixturesData = db.getFixturesMessage.get();
    
    if (!fixturesData || !fixturesData.fixtures_message_id) {
      const errorEmbed = createErrorEmbed('No Fixtures', 'No fixtures message has been posted.');
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    // Mark current fixtures as done
    db.markFixturesAsDone.run();
    
    // Update the fixtures embed to show green and mark as done
    try {
      const fixturesChannelSetting = db.getSetting.get('fixtures_channel');
      if (fixturesChannelSetting) {
        const channel = await interaction.client.channels.fetch(fixturesChannelSetting.value);
        if (channel) {
          const message = await channel.messages.fetch(fixturesData.fixtures_message_id);
          const doneEmbed = createFixturesDoneEmbed();
          await message.edit({ embeds: [doneEmbed] });
        }
      }
    } catch (err) {
      console.log('Could not fetch or edit fixtures message:', err);
    }
    
    // Delete all matches from database
    db.deleteAllMatches.run();
    
    const successEmbed = createSuccessEmbed('Fixtures Archived', 
      'Current fixtures have been archived and marked as done. The fixtures embed is now green. All matches have been deleted from the database. You can now post new fixtures.');
    return interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error marking fixtures as done:', error);
    const errorEmbed = createErrorEmbed('Error', 'Failed to archive fixtures.');
    return interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleRemove(interaction) {
  if (!isAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only administrators can remove fixtures.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const fixturesData = db.getFixturesMessage.get();
    
    if (!fixturesData || !fixturesData.fixtures_message_id) {
      const errorEmbed = createErrorEmbed('No Fixtures', 'No fixtures message has been posted.');
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    // Check if fixtures are marked as done (protected)
    const isDone = db.isFixturesMessageDone.get();
    if (isDone && isDone.is_marked_done) {
      const errorEmbed = createErrorEmbed('Protected', 'This fixtures embed is archived and protected. It cannot be deleted.');
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    try {
      const fixturesChannelSetting = db.getSetting.get('fixtures_channel');
      if (fixturesChannelSetting) {
        const channel = await interaction.client.channels.fetch(fixturesChannelSetting.value);
        if (channel) {
          const message = await channel.messages.fetch(fixturesData.fixtures_message_id);
          await message.delete();
        }
      }
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

async function handleUpdate(interaction) {
  if (!isAdmin(interaction.member)) {
    const errorEmbed = createErrorEmbed('Permission Denied', 'Only administrators can update fixtures.');
    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const fixturesData = db.getFixturesMessage.get();
    
    if (!fixturesData || !fixturesData.fixtures_message_id) {
      const errorEmbed = createErrorEmbed('No Fixtures', 'No fixtures message has been posted.');
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    // Check if fixtures are marked as done (protected)
    const isDone = db.isFixturesMessageDone.get();
    if (isDone && isDone.is_marked_done) {
      const errorEmbed = createErrorEmbed('Protected', 'This fixtures embed is archived and protected. It cannot be updated.');
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    const matches = db.getAllUpcomingMatches.all();

    if (matches.length === 0) {
      const errorEmbed = createErrorEmbed('No Matches', 'There are no upcoming scheduled matches.');
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    const embed = createFixturesEmbed(matches);

    try {
      const fixturesChannelSetting = db.getSetting.get('fixtures_channel');
      if (!fixturesChannelSetting) {
        const errorEmbed = createErrorEmbed('Error', 'Fixtures channel has not been set.');
        return interaction.editReply({ embeds: [errorEmbed] });
      }

      const channel = await interaction.client.channels.fetch(fixturesChannelSetting.value);
      if (!channel) {
        const errorEmbed = createErrorEmbed('Error', 'Fixtures channel not found.');
        return interaction.editReply({ embeds: [errorEmbed] });
      }

      const message = await channel.messages.fetch(fixturesData.fixtures_message_id);
      await message.edit({ embeds: [embed] });

      const successEmbed = createSuccessEmbed('Fixtures Updated', `Updated ${matches.length} match(es) in the fixtures embed.`);
      return interaction.editReply({ embeds: [successEmbed] });
    } catch (err) {
      console.error('Error fetching or updating fixtures message:', err);
      const errorEmbed = createErrorEmbed('Error', 'Could not update the fixtures message. It may have been deleted.');
      return interaction.editReply({ embeds: [errorEmbed] });
    }
  } catch (error) {
    console.error('Error updating fixtures:', error);
    const errorEmbed = createErrorEmbed('Error', 'Failed to update fixtures.');
    return interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'setchannel':
      return handleSetChannel(interaction);
    case 'post':
      return handlePost(interaction);
    case 'done':
      return handleDone(interaction);
    case 'remove':
      return handleRemove(interaction);
    case 'update':
      return handleUpdate(interaction);
  }
}

module.exports = {
  command,
  execute
};
