const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { isReferee } = require('../utils/permissions');

const command = new SlashCommandBuilder()
  .setName('results')
  .setDescription('Post match results')
  .addSubcommand(subcommand =>
    subcommand
      .setName('setchannel')
      .setDescription('Set the channel for posting match results')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Channel to post results')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('post')
      .setDescription('Post a match result')
      .addUserOption(option =>
        option.setName('team1')
          .setDescription('First team')
          .setRequired(true))
      .addUserOption(option =>
        option.setName('team2')
          .setDescription('Second team')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('score')
          .setDescription('Final score (e.g., 3-2)')
          .setRequired(true))
      .addUserOption(option =>
        option.setName('motm')
          .setDescription('Man of the Match')
          .setRequired(true))
      .addUserOption(option =>
        option.setName('mention1')
          .setDescription('First mention')
          .setRequired(true))
      .addUserOption(option =>
        option.setName('mention2')
          .setDescription('Second mention')
          .setRequired(true))
      .addUserOption(option =>
        option.setName('mention3')
          .setDescription('Third mention')
          .setRequired(true))
      .addUserOption(option =>
        option.setName('scorer1')
          .setDescription('First scorer')
          .setRequired(false))
      .addIntegerOption(option =>
        option.setName('goals1')
          .setDescription('Goals by first scorer')
          .setRequired(false))
      .addUserOption(option =>
        option.setName('scorer2')
          .setDescription('Second scorer')
          .setRequired(false))
      .addIntegerOption(option =>
        option.setName('goals2')
          .setDescription('Goals by second scorer')
          .setRequired(false))
      .addUserOption(option =>
        option.setName('scorer3')
          .setDescription('Third scorer')
          .setRequired(false))
      .addIntegerOption(option =>
        option.setName('goals3')
          .setDescription('Goals by third scorer')
          .setRequired(false))
      .addUserOption(option =>
        option.setName('assister1')
          .setDescription('First assister')
          .setRequired(false))
      .addIntegerOption(option =>
        option.setName('assist1')
          .setDescription('Assists by first assister')
          .setRequired(false))
      .addUserOption(option =>
        option.setName('assister2')
          .setDescription('Second assister')
          .setRequired(false))
      .addIntegerOption(option =>
        option.setName('assist2')
          .setDescription('Assists by second assister')
          .setRequired(false))
      .addUserOption(option =>
        option.setName('assister3')
          .setDescription('Third assister')
          .setRequired(false))
      .addIntegerOption(option =>
        option.setName('assist3')
          .setDescription('Assists by third assister')
          .setRequired(false)));

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'setchannel':
      return handleSetChannel(interaction);
    case 'post':
      return handlePost(interaction);
  }
}

async function handleSetChannel(interaction) {
  if (!isReferee(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only referees can set the results channel.')], ephemeral: true });
  }

  const channel = interaction.options.getChannel('channel');
  
  db.setSetting.run('results_channel', channel.id);
  
  return interaction.reply({ embeds: [createSuccessEmbed('Results Channel Set', `${channel} has been set as the channel for posting match results.`)] });
}

async function handlePost(interaction) {
  if (!isReferee(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only referees can post match results.')], ephemeral: true });
  }

  const team1User = interaction.options.getUser('team1');
  const team2User = interaction.options.getUser('team2');
  const score = interaction.options.getString('score');
  const motmUser = interaction.options.getUser('motm');
  const mention1 = interaction.options.getUser('mention1');
  const mention2 = interaction.options.getUser('mention2');
  const mention3 = interaction.options.getUser('mention3');

  const scorers = [];
  for (let i = 1; i <= 3; i++) {
    const scorer = interaction.options.getUser(`scorer${i}`);
    const goals = interaction.options.getInteger(`goals${i}`);
    if (scorer && goals) {
      scorers.push({ player: scorer, goals });
      db.createOrUpdatePlayer.run(scorer.id, scorer.username);
    }
  }

  const assisters = [];
  for (let i = 1; i <= 3; i++) {
    const assister = interaction.options.getUser(`assister${i}`);
    const assists = interaction.options.getInteger(`assist${i}`);
    if (assister && assists) {
      assisters.push({ player: assister, assists });
      db.createOrUpdatePlayer.run(assister.id, assister.username);
    }
  }

  const motmPlayer = db.getPlayer.get(motmUser.id);
  if (motmPlayer) {
    const currentMOTM = motmPlayer.motm || 0;
    db.db.prepare(`UPDATE players SET motm = ? WHERE discord_id = ?`).run(currentMOTM + 1, motmUser.id);
  } else {
    db.createOrUpdatePlayer.run(motmUser.id, motmUser.username);
  }

  for (const { player } of scorers) {
    const scorerPlayer = db.getPlayer.get(player.id);
    if (scorerPlayer) {
      const currentGoals = scorerPlayer.goals || 0;
      db.db.prepare(`UPDATE players SET goals = ? WHERE discord_id = ?`).run(currentGoals + 1, player.id);
    }
  }

  for (const { player } of assisters) {
    const assisterPlayer = db.getPlayer.get(player.id);
    if (assisterPlayer) {
      const currentAssists = assisterPlayer.assists || 0;
      db.db.prepare(`UPDATE players SET assists = ? WHERE discord_id = ?`).run(currentAssists + 1, player.id);
    }
  }

  for (const mention of [mention1, mention2, mention3]) {
    const mentionPlayer = db.getPlayer.get(mention.id);
    if (mentionPlayer) {
      const currentMentions = mentionPlayer.mentions || 0;
      db.db.prepare(`UPDATE players SET mentions = ? WHERE discord_id = ?`).run(currentMentions + 1, mention.id);
    } else {
      db.createOrUpdatePlayer.run(mention.id, mention.username);
    }
  }

  const resultsChannelSetting = db.getSetting.get('results_channel');
  if (resultsChannelSetting) {
    try {
      const channel = await interaction.guild.channels.fetch(resultsChannelSetting.value);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle('⚽ Match Result')
          .setDescription(`**${team1User.username}** ${score} **${team2User.username}**`)
          .setThumbnail(motmUser.displayAvatarURL());

        if (scorers.length > 0) {
          const scorerList = scorers.map(s => `<@${s.player.id}> - **${s.goals}**`).join('\n');
          embed.addFields({ name: 'Scorers', value: scorerList, inline: true });
        }

        if (assisters.length > 0) {
          const assisterList = assisters.map(a => `<@${a.player.id}> - **${a.assists}**`).join('\n');
          embed.addFields({ name: 'Assisters', value: assisterList, inline: true });
        }

        embed.addFields(
          { name: 'Man of the Match', value: `<@${motmUser.id}>`, inline: false },
          { name: 'Mentions', value: `<@${mention1.id}>\n<@${mention2.id}>\n<@${mention3.id}>`, inline: false }
        )
          .setFooter({ text: `Posted by ${interaction.user.username}` })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error posting result:', error);
    }
  }

  return interaction.reply({ embeds: [createSuccessEmbed('Result Posted', 'Match result has been posted successfully.')], ephemeral: true });
}

module.exports = { command, execute };
