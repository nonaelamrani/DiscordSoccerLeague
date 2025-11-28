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
      .setName('contract')
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
          .setRequired(true))
      .addStringOption(option =>
        option.setName('position')
          .setDescription('Player position')
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
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('setmanagerrole')
      .setDescription('Set the global manager role')
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('The manager role')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('removemanager')
      .setDescription('Remove a manager from a team')
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Team role')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('setrefereerole')
      .setDescription('Set the global referee role')
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('The referee role')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('transactionschannel')
      .setDescription('Set the channel for logging contract transactions')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Channel to log transactions')
          .setRequired(true)));

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'create':
      return handleCreate(interaction);
    case 'delete':
      return handleDelete(interaction);
    case 'contract':
      return handleOffer(interaction);
    case 'release':
      return handleRelease(interaction);
    case 'roster':
      return handleRoster(interaction);
    case 'setmanager':
      return handleSetManager(interaction);
    case 'setmanagerrole':
      return handleSetManagerRole(interaction);
    case 'removemanager':
      return handleRemoveManager(interaction);
    case 'setrefereerole':
      return handleSetRefereeRole(interaction);
    case 'transactionschannel':
      return handleTransactionsChannel(interaction);
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
    const existingByRole = db.getTeamByRoleId.get(role.id);
    if (existingByRole) {
      return interaction.reply({ embeds: [createErrorEmbed('Error', 'A team with this role already exists.')], ephemeral: true });
    }

    const existingByName = db.getTeamByName.get(name);
    if (existingByName) {
      return interaction.reply({ embeds: [createErrorEmbed('Error', `A team with the name "${name}" already exists.`)], ephemeral: true });
    }

    db.createTeam.run(name, short, role.id, null);
    return interaction.reply({ embeds: [createSuccessEmbed('Team Created', `Team **${name}** [${short}] has been created with role ${role}.`)] });
  } catch (error) {
    console.error('Error creating team:', error);
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
  if (isAdmin(interaction.member)) {
    let team = null;
    for (const [roleId] of interaction.member.roles.cache) {
      const foundTeam = db.getTeamByRoleId.get(roleId);
      if (foundTeam) {
        team = foundTeam;
        break;
      }
    }
    if (!team) {
      return interaction.reply({ embeds: [createErrorEmbed('Error', 'You are not associated with any team. Admins must have a team role to send offers.')], ephemeral: true });
    }
    return processOffer(interaction, team);
  }

  const managerRoleSetting = db.getSetting.get('manager_role');
  if (!managerRoleSetting) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Manager role has not been set. An admin must use `/team setmanagerrole` first.')], ephemeral: true });
  }
  
  if (!interaction.member.roles.cache.has(managerRoleSetting.value)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'You must have the Manager role to send contract offers.')], ephemeral: true });
  }

  let team = null;
  for (const [roleId] of interaction.member.roles.cache) {
    const foundTeam = db.getTeamByRoleId.get(roleId);
    if (foundTeam && foundTeam.manager_id === interaction.member.id) {
      team = foundTeam;
      break;
    }
  }

  if (!team) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'You must be the manager of a team and have both the Manager role and team role.')], ephemeral: true });
  }

  if (!interaction.member.roles.cache.has(team.role_id)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'You must have the team role to send offers for this team.')], ephemeral: true });
  }

  return processOffer(interaction, team);
}

async function processOffer(interaction, team) {
  const player = interaction.options.getUser('player');
  const salary = interaction.options.getString('salary');
  const duration = interaction.options.getString('duration');
  const position = interaction.options.getString('position');

  if (player.bot) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Cannot send offers to bots.')], ephemeral: true });
  }

  if (player.id === interaction.user.id) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'You cannot send a contract offer to yourself.')], ephemeral: true });
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
      embeds: [createOfferEmbed(team, salary, duration, position)], 
      components: [row] 
    });

    db.createPendingOffer.run(player.id, team.id, salary, duration, position, offerMessage.id);

    return interaction.reply({ embeds: [createSuccessEmbed('Offer Sent', `Contract offer sent to <@${player.id}>.`)], ephemeral: true });
  } catch (error) {
    console.error('Error sending offer:', error);
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Failed to send offer. The player may have DMs disabled.')], ephemeral: true });
  }
}

async function handleRelease(interaction) {
  let team = null;

  if (isAdmin(interaction.member)) {
    for (const [roleId] of interaction.member.roles.cache) {
      const foundTeam = db.getTeamByRoleId.get(roleId);
      if (foundTeam) {
        team = foundTeam;
        break;
      }
    }
    if (!team) {
      return interaction.reply({ embeds: [createErrorEmbed('Error', 'You are not associated with any team. Admins must have a team role to release players.')], ephemeral: true });
    }
  } else {
    const managerRoleSetting = db.getSetting.get('manager_role');
    if (!managerRoleSetting) {
      return interaction.reply({ embeds: [createErrorEmbed('Error', 'Manager role has not been set. An admin must use `/team setmanagerrole` first.')], ephemeral: true });
    }
    
    if (!interaction.member.roles.cache.has(managerRoleSetting.value)) {
      return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'You must have the Manager role to release players.')], ephemeral: true });
    }

    for (const [roleId] of interaction.member.roles.cache) {
      const foundTeam = db.getTeamByRoleId.get(roleId);
      if (foundTeam && foundTeam.manager_id === interaction.member.id) {
        team = foundTeam;
        break;
      }
    }

    if (!team) {
      return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'You must be the manager of a team and have both the Manager role and team role.')], ephemeral: true });
    }

    if (!interaction.member.roles.cache.has(team.role_id)) {
      return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'You must have the team role to release players from this team.')], ephemeral: true });
    }
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

  const transactionChannelSetting = db.getSetting.get('transactions_channel');
  if (transactionChannelSetting) {
    try {
      const channel = await interaction.guild.channels.fetch(transactionChannelSetting.value);
      if (channel) {
        const { EmbedBuilder } = require('discord.js');
        
        let contractorName = 'Unknown';
        try {
          const contractorUser = await interaction.guild.members.fetch(team.manager_id);
          contractorName = contractorUser.user.username;
        } catch (e) {
          console.error('Error fetching contractor:', e);
        }
        
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Player Released')
          .setDescription(`<@${playerUser.id}> has been released from **${team.name}**`)
          .setThumbnail(playerUser.displayAvatarURL())
          .addFields(
            { name: 'Player', value: `<@${playerUser.id}>`, inline: true },
            { name: 'Team', value: team.name, inline: true },
            { name: 'Released by', value: contractorName, inline: true },
            { name: 'Released on', value: new Date().toLocaleString(), inline: false }
          )
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error logging transaction:', error);
    }
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

  const managerRoleSetting = db.getSetting.get('manager_role');
  if (!managerRoleSetting) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Manager role has not been set. Use `/team setmanagerrole` first.')], ephemeral: true });
  }

  const managerUser = interaction.options.getUser('manager');
  const role = interaction.options.getRole('role');

  const team = db.getTeamByRoleId.get(role.id);
  if (!team) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'No team found with this role.')], ephemeral: true });
  }

  if (team.manager_id) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', `This team already has a manager (<@${team.manager_id}>). Use \`/team removemanager\` first.`)], ephemeral: true });
  }

  const existingTeam = db.getTeamByManagerId.get(managerUser.id);
  if (existingTeam) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', `<@${managerUser.id}> is already the manager of **${existingTeam.name}**. A user can only manage one team.`)], ephemeral: true });
  }

  db.createOrUpdatePlayer.run(managerUser.id, managerUser.username);
  const player = db.getPlayer.get(managerUser.id);

  db.setTeamManager.run(managerUser.id, team.id);
  db.addMembership.run(player.id, team.id, 'manager', null, null);

  try {
    const member = await interaction.guild.members.fetch(managerUser.id);
    await member.roles.add(role.id);
    await member.roles.add(managerRoleSetting.value);
  } catch (error) {
    console.error('Error adding roles:', error);
  }

  return interaction.reply({ embeds: [createSuccessEmbed('Manager Set', `<@${managerUser.id}> is now the manager of **${team.name}** and has been given the Manager role.`)] });
}

async function handleSetManagerRole(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can set the manager role.')], ephemeral: true });
  }

  const role = interaction.options.getRole('role');
  
  db.setSetting.run('manager_role', role.id);
  
  return interaction.reply({ embeds: [createSuccessEmbed('Manager Role Set', `${role} has been set as the global Manager role. Managers must have this role to use manager commands.`)] });
}

async function handleRemoveManager(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can remove managers.')], ephemeral: true });
  }

  const role = interaction.options.getRole('role');

  const team = db.getTeamByRoleId.get(role.id);
  if (!team) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'No team found with this role.')], ephemeral: true });
  }

  if (!team.manager_id) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'This team does not have a manager.')], ephemeral: true });
  }

  const managerId = team.manager_id;
  const player = db.getPlayer.get(managerId);

  db.clearTeamManager.run(team.id);
  
  if (player) {
    db.removeMembership.run(player.id, team.id);
  }

  const managerRoleSetting = db.getSetting.get('manager_role');

  try {
    const member = await interaction.guild.members.fetch(managerId);
    await member.roles.remove(role.id);
    if (managerRoleSetting) {
      await member.roles.remove(managerRoleSetting.value);
    }
  } catch (error) {
    console.error('Error removing roles:', error);
  }

  return interaction.reply({ embeds: [createSuccessEmbed('Manager Removed', `<@${managerId}> is no longer the manager of **${team.name}**.`)] });
}

async function handleSetRefereeRole(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can set the referee role.')], ephemeral: true });
  }

  const role = interaction.options.getRole('role');
  
  db.setSetting.run('referee_role', role.id);
  
  return interaction.reply({ embeds: [createSuccessEmbed('Referee Role Set', `${role} has been set as the global Referee role.`)] });
}

async function handleTransactionsChannel(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can set the transactions channel.')], ephemeral: true });
  }

  const channel = interaction.options.getChannel('channel');
  
  db.setSetting.run('transactions_channel', channel.id);
  
  return interaction.reply({ embeds: [createSuccessEmbed('Transactions Channel Set', `${channel} has been set as the channel for logging contract transactions.`)] });
}

module.exports = { command, execute };
