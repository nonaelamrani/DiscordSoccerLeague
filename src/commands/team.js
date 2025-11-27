const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');
const { isAdmin, isManagerOfTeam, getManagerTeam } = require('../utils/permissions');
const { createSuccessEmbed, createErrorEmbed, createRosterEmbed, createOfferEmbed } = require('../utils/embeds');

const command = new SlashCommandBuilder()
  .setName('team')
  .setDescription('Team management commands')
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Create a new team')
      .addStringOption(option =>
        option.setName('name')
          .setDescription('Team name')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('short')
          .setDescription('Short name/abbreviation')
          .setRequired(true))
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Team role')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete a team')
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Team role')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('offer')
      .setDescription('Send a contract offer to a player')
      .addUserOption(option =>
        option.setName('player')
          .setDescription('Player to offer contract')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('salary')
          .setDescription('Contract salary')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('duration')
          .setDescription('Contract duration')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('release')
      .setDescription('Release a player from the team')
      .addUserOption(option =>
        option.setName('player')
          .setDescription('Player to release')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('roster')
      .setDescription('Show team roster'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('setmanager')
      .setDescription('Set a team manager')
      .addUserOption(option =>
        option.setName('manager')
          .setDescription('User to set as manager')
          .setRequired(true))
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Team role')
          .setRequired(true)));

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'create':
      return handleCreate(interaction);
    case 'delete':
      return handleDelete(interaction);
    case 'offer':
      return handleOffer(interaction);
    case 'release':
      return handleRelease(interaction);
    case 'roster':
      return handleRoster(interaction);
    case 'setmanager':
      return handleSetManager(interaction);
  }
}

async function handleCreate(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can create teams.')], ephemeral: true });
  }

  const name = interaction.options.getString('name');
  const short = interaction.options.getString('short');
  const role = interaction.options.getRole('role');

  try {
    const existing = db.getTeamByRoleId.get(role.id);
    if (existing) {
      return interaction.reply({ embeds: [createErrorEmbed('Error', 'A team with this role already exists.')], ephemeral: true });
    }

    db.createTeam.run(name, short, role.id, null);
    return interaction.reply({ embeds: [createSuccessEmbed('Team Created', `Team **${name}** [${short}] has been created with role ${role}.`)] });
  } catch (error) {
    console.error('Error creating team:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return interaction.reply({ embeds: [createErrorEmbed('Error', 'A team with this name already exists.')], ephemeral: true });
    }
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Failed to create team.')], ephemeral: true });
  }
}

async function handleDelete(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can delete teams.')], ephemeral: true });
  }

  const role = interaction.options.getRole('role');

  const team = db.getTeamByRoleId.get(role.id);
  if (!team) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'No team found with this role.')], ephemeral: true });
  }

  db.deleteTeamByRoleId.run(role.id);
  return interaction.reply({ embeds: [createSuccessEmbed('Team Deleted', `Team **${team.name}** has been deleted.`)] });
}

async function handleOffer(interaction) {
  const managerTeam = getManagerTeam(interaction.member);
  
  if (!managerTeam && !isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only team managers can send contract offers.')], ephemeral: true });
  }

  let team = managerTeam;
  if (!team) {
    const memberRoles = interaction.member.roles.cache;
    for (const [roleId] of memberRoles) {
      const foundTeam = db.getTeamByRoleId.get(roleId);
      if (foundTeam && foundTeam.manager_id === interaction.member.id) {
        team = foundTeam;
        break;
      }
    }
  }

  if (!team) {
    for (const [roleId] of interaction.member.roles.cache) {
      const foundTeam = db.getTeamByRoleId.get(roleId);
      if (foundTeam) {
        team = foundTeam;
        break;
      }
    }
  }

  if (!team) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'You are not associated with any team.')], ephemeral: true });
  }

  const player = interaction.options.getUser('player');
  const salary = interaction.options.getString('salary');
  const duration = interaction.options.getString('duration');

  if (player.bot) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Cannot send offers to bots.')], ephemeral: true });
  }

  try {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`offer_accept_${team.id}`)
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`offer_decline_${team.id}`)
          .setLabel('Decline')
          .setStyle(ButtonStyle.Danger)
      );

    const dmChannel = await player.createDM();
    const offerMessage = await dmChannel.send({ 
      embeds: [createOfferEmbed(team, salary, duration)], 
      components: [row] 
    });

    db.createPendingOffer.run(player.id, team.id, salary, duration, offerMessage.id);

    return interaction.reply({ embeds: [createSuccessEmbed('Offer Sent', `Contract offer sent to <@${player.id}>.`)], ephemeral: true });
  } catch (error) {
    console.error('Error sending offer:', error);
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Failed to send offer. The player may have DMs disabled.')], ephemeral: true });
  }
}

async function handleRelease(interaction) {
  const managerTeam = getManagerTeam(interaction.member);
  
  if (!managerTeam && !isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only team managers can release players.')], ephemeral: true });
  }

  let team = managerTeam;
  if (!team) {
    for (const [roleId] of interaction.member.roles.cache) {
      const foundTeam = db.getTeamByRoleId.get(roleId);
      if (foundTeam) {
        team = foundTeam;
        break;
      }
    }
  }

  if (!team) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'You are not associated with any team.')], ephemeral: true });
  }

  const playerUser = interaction.options.getUser('player');
  const player = db.getPlayer.get(playerUser.id);

  if (!player) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Player not found in database.')], ephemeral: true });
  }

  const membership = db.getMembership.get(player.id, team.id);
  if (!membership) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'This player is not on your team.')], ephemeral: true });
  }

  db.removeMembership.run(player.id, team.id);

  try {
    const member = await interaction.guild.members.fetch(playerUser.id);
    await member.roles.remove(team.role_id);
  } catch (error) {
    console.error('Error removing role:', error);
  }

  return interaction.reply({ embeds: [createSuccessEmbed('Player Released', `<@${playerUser.id}> has been released from **${team.name}**.`)] });
}

async function handleRoster(interaction) {
  let team = null;
  
  for (const [roleId] of interaction.member.roles.cache) {
    const foundTeam = db.getTeamByRoleId.get(roleId);
    if (foundTeam) {
      team = foundTeam;
      break;
    }
  }

  if (!team) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'You are not part of any team.')], ephemeral: true });
  }

  const members = db.getTeamMembers.all(team.id);
  return interaction.reply({ embeds: [createRosterEmbed(team, members, interaction.guild)] });
}

async function handleSetManager(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can set team managers.')], ephemeral: true });
  }

  const managerUser = interaction.options.getUser('manager');
  const role = interaction.options.getRole('role');

  const team = db.getTeamByRoleId.get(role.id);
  if (!team) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'No team found with this role.')], ephemeral: true });
  }

  db.createOrUpdatePlayer.run(managerUser.id, managerUser.username);
  const player = db.getPlayer.get(managerUser.id);

  db.setTeamManager.run(managerUser.id, team.id);
  db.addMembership.run(player.id, team.id, 'manager', null, null);

  try {
    const member = await interaction.guild.members.fetch(managerUser.id);
    await member.roles.add(role.id);
    
    const managerRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'manager');
    if (managerRole) {
      await member.roles.add(managerRole.id);
    }
  } catch (error) {
    console.error('Error adding roles:', error);
  }

  return interaction.reply({ embeds: [createSuccessEmbed('Manager Set', `<@${managerUser.id}> is now the manager of **${team.name}**.`)] });
}

module.exports = { command, execute };
