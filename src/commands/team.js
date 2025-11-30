const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');
const { isAdmin, isManagerOfTeam, getManagerTeam } = require('../utils/permissions');
const { createSuccessEmbed, createErrorEmbed, createRosterEmbed, createOfferEmbed } = require('../utils/embeds');
const { unixToTimestamp } = require('../utils/timestamps');

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
      .setDescription('Show team roster')
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Team role')
          .setRequired(true)))
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
      .setName('setassistantmanager')
      .setDescription('Set an assistant manager for a team')
      .addUserOption(option =>
        option.setName('assistantmanager')
          .setDescription('User to set as assistant manager')
          .setRequired(true))
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Team role')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('removeassistantmanager')
      .setDescription('Remove an assistant manager from a team')
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Team role')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('setassistantmanagerrole')
      .setDescription('Set the global assistant manager role')
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('The assistant manager role')
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
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('demand')
      .setDescription('Force release yourself from a team (Max 2 uses per player)'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('addplayer')
      .setDescription('Add a player to a team without an offer (Admin only)')
      .addUserOption(option =>
        option.setName('player')
          .setDescription('Player to add')
          .setRequired(true))
      .addRoleOption(option =>
        option.setName('team')
          .setDescription('Team role')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('removeplayer')
      .setDescription('Remove a player from a team (Admin only)')
      .addUserOption(option =>
        option.setName('player')
          .setDescription('Player to remove')
          .setRequired(true))
      .addRoleOption(option =>
        option.setName('team')
          .setDescription('Team role')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('cleardatabase')
      .setDescription('Clear entire database (Owner only)')
      .addBooleanOption(option =>
        option.setName('confirm1')
          .setDescription('Confirm deletion (must be true)')
          .setRequired(true))
      .addBooleanOption(option =>
        option.setName('confirm2')
          .setDescription('Confirm deletion (must be true)')
          .setRequired(true))
      .addBooleanOption(option =>
        option.setName('confirm3')
          .setDescription('Confirm deletion (must be true)')
          .setRequired(true))
      .addBooleanOption(option =>
        option.setName('confirm4')
          .setDescription('Confirm deletion (must be true)')
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
    case 'setassistantmanager':
      return handleSetAssistantManager(interaction);
    case 'removeassistantmanager':
      return handleRemoveAssistantManager(interaction);
    case 'setassistantmanagerrole':
      return handleSetAssistantManagerRole(interaction);
    case 'setrefereerole':
      return handleSetRefereeRole(interaction);
    case 'transactionschannel':
      return handleTransactionsChannel(interaction);
    case 'demand':
      return handleDemand(interaction);
    case 'addplayer':
      return handleAddPlayer(interaction);
    case 'removeplayer':
      return handleRemovePlayer(interaction);
    case 'cleardatabase':
      return handleClearDatabase(interaction);
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
  const assistantManagerRoleSetting = db.getSetting.get('assistant_manager_role');
  
  if (!managerRoleSetting && !assistantManagerRoleSetting) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Manager or Assistant Manager role has not been set.')], ephemeral: true });
  }
  
  const hasManagerRole = managerRoleSetting && interaction.member.roles.cache.has(managerRoleSetting.value);
  const hasAssistantManagerRole = assistantManagerRoleSetting && interaction.member.roles.cache.has(assistantManagerRoleSetting.value);
  
  if (!hasManagerRole && !hasAssistantManagerRole) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'You must have the Manager or Assistant Manager role to send contract offers.')], ephemeral: true });
  }

  let team = null;
  for (const [roleId] of interaction.member.roles.cache) {
    const foundTeam = db.getTeamByRoleId.get(roleId);
    if (foundTeam && isManagerOfTeam(interaction.member, foundTeam)) {
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

  // Check if target player is a manager or assistant manager of any team
  const targetManager = db.getTeamByManagerId.get(player.id);
  const targetAssistantManager = db.getTeamByAssistantManagerId.get(player.id);
  if (targetManager) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', `<@${player.id}> is a manager of **${targetManager.name}** and cannot receive contract offers.`)], ephemeral: true });
  }
  if (targetAssistantManager) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', `<@${player.id}> is an assistant manager of **${targetAssistantManager.name}** and cannot receive contract offers.`)], ephemeral: true });
  }

  // Check if target player is already signed to a team
  const playerRecord = db.getPlayer.get(player.id);
  if (playerRecord) {
    const existingTeams = db.getPlayerTeams.all(playerRecord.id);
    if (existingTeams.length > 0) {
      const teamList = existingTeams.map(t => `**${t.name}**`).join(', ');
      return interaction.reply({ embeds: [createErrorEmbed('Error', `<@${player.id}> is already signed to ${teamList} and cannot receive offers from other teams.`)], ephemeral: true });
    }
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
    const assistantManagerRoleSetting = db.getSetting.get('assistant_manager_role');
    
    if (!managerRoleSetting && !assistantManagerRoleSetting) {
      return interaction.reply({ embeds: [createErrorEmbed('Error', 'Manager or Assistant Manager role has not been set.')], ephemeral: true });
    }
    
    const hasManagerRole = managerRoleSetting && interaction.member.roles.cache.has(managerRoleSetting.value);
    const hasAssistantManagerRole = assistantManagerRoleSetting && interaction.member.roles.cache.has(assistantManagerRoleSetting.value);
    
    if (!hasManagerRole && !hasAssistantManagerRole) {
      return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'You must have the Manager or Assistant Manager role to release players.')], ephemeral: true });
    }

    for (const [roleId] of interaction.member.roles.cache) {
      const foundTeam = db.getTeamByRoleId.get(roleId);
      if (foundTeam && isManagerOfTeam(interaction.member, foundTeam)) {
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
  
  // Prevent self-targeting
  if (playerUser.id === interaction.user.id) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'You cannot release yourself from a team.')], ephemeral: true });
  }

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
        
        const unixTimestamp = Math.floor(Date.now() / 1000);
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Player Released')
          .setDescription(`<@${playerUser.id}> has been released from **${team.name}**`)
          .setThumbnail(playerUser.displayAvatarURL())
          .addFields(
            { name: 'Player', value: `<@${playerUser.id}>`, inline: true },
            { name: 'Team', value: team.name, inline: true },
            { name: 'Released by', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Released on', value: unixToTimestamp(unixTimestamp), inline: false }
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
  const role = interaction.options.getRole('role');

  const team = db.getTeamByRoleId.get(role.id);
  if (!team) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'No team found with this role.')], ephemeral: true });
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

  // Check if the user is already an assistant manager
  const isAssistantManager = db.getAssistantManagerTeams.all(managerUser.id);
  if (isAssistantManager.length > 0) {
    const teamIds = isAssistantManager.map(a => a.team_id);
    const assistantTeams = teamIds.map(id => db.getTeamById.get(id));
    const teamList = assistantTeams.map(t => `**${t.name}**`).join(', ');
    return interaction.reply({ embeds: [createErrorEmbed('Error', `<@${managerUser.id}> is already an assistant manager of ${teamList}. A user cannot be both a manager and an assistant manager.`)], ephemeral: true });
  }

  db.createOrUpdatePlayer.run(managerUser.id, managerUser.username);
  const player = db.getPlayer.get(managerUser.id);

  // Check if the user is already a player on any team
  const playerTeams = db.getPlayerTeams.all(player.id);
  if (playerTeams.length > 0) {
    const teamList = playerTeams.map(t => `**${t.name}**`).join(', ');
    return interaction.reply({ embeds: [createErrorEmbed('Error', `<@${managerUser.id}> is already a player on ${teamList}. A user cannot be both a player and a manager.`)], ephemeral: true });
  }

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

async function handleSetAssistantManager(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can set assistant managers.')], ephemeral: true });
  }

  const assistantManagerRoleSetting = db.getSetting.get('assistant_manager_role');
  if (!assistantManagerRoleSetting) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Assistant Manager role has not been set. Use `/team setassistantmanagerrole` first.')], ephemeral: true });
  }

  const assistantManagerUser = interaction.options.getUser('assistantmanager');
  const role = interaction.options.getRole('role');

  const team = db.getTeamByRoleId.get(role.id);
  if (!team) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'No team found with this role.')], ephemeral: true });
  }

  // Check if team already has 2 assistant managers
  const existingAssistants = db.getTeamAssistantManagers.all(team.id);
  if (existingAssistants.length >= 2) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', `This team already has 2 assistant managers (max capacity). Use \`/team removeassistantmanager\` first.`)], ephemeral: true });
  }

  // Check if user is already a manager
  const isManager = db.getTeamByManagerId.get(assistantManagerUser.id);
  if (isManager) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', `<@${assistantManagerUser.id}> is already the manager of **${isManager.name}**. A user cannot be both a manager and an assistant manager.`)], ephemeral: true });
  }

  // Check if user is already an assistant manager of another team
  const userAssistantTeams = db.getAssistantManagerTeams.all(assistantManagerUser.id);
  if (userAssistantTeams.length > 0) {
    const otherTeamIds = userAssistantTeams.map(t => t.team_id).filter(id => id !== team.id);
    if (otherTeamIds.length > 0) {
      const otherTeams = otherTeamIds.map(id => db.getTeamById.get(id));
      const teamList = otherTeams.map(t => `**${t.name}**`).join(', ');
      return interaction.reply({ embeds: [createErrorEmbed('Error', `<@${assistantManagerUser.id}> is already an assistant manager of ${teamList}.`)], ephemeral: true });
    }
  }

  db.createOrUpdatePlayer.run(assistantManagerUser.id, assistantManagerUser.username);
  const player = db.getPlayer.get(assistantManagerUser.id);

  // Check if user is a player
  const playerTeams = db.getPlayerTeams.all(player.id);
  
  // If user is a player, they can only be assistant manager of the same team they play for
  if (playerTeams.length > 0) {
    const isPlayerOnThisTeam = playerTeams.some(t => t.id === team.id);
    if (!isPlayerOnThisTeam) {
      const teamList = playerTeams.map(t => `**${t.name}**`).join(', ');
      return interaction.reply({ embeds: [createErrorEmbed('Error', `<@${assistantManagerUser.id}> is a player on ${teamList}. Assistant managers can only be players on the same team.`)], ephemeral: true });
    }
  }

  db.addAssistantManager.run(assistantManagerUser.id, team.id);

  try {
    const member = await interaction.guild.members.fetch(assistantManagerUser.id);
    await member.roles.add(role.id);
    await member.roles.add(assistantManagerRoleSetting.value);
  } catch (error) {
    console.error('Error adding roles:', error);
  }

  return interaction.reply({ embeds: [createSuccessEmbed('Assistant Manager Set', `<@${assistantManagerUser.id}> is now an assistant manager of **${team.name}** and has been given the Assistant Manager role.`)] });
}

async function handleRemoveAssistantManager(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can remove assistant managers.')], ephemeral: true });
  }

  const role = interaction.options.getRole('role');

  const team = db.getTeamByRoleId.get(role.id);
  if (!team) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'No team found with this role.')], ephemeral: true });
  }

  const assistants = db.getTeamAssistantManagers.all(team.id);
  if (assistants.length === 0) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'This team does not have any assistant managers.')], ephemeral: true });
  }

  // If only one, remove it. If multiple, ask user to be more specific via DM or use a button interface
  let assistantToRemove;
  if (assistants.length === 1) {
    assistantToRemove = assistants[0];
  } else {
    // For multiple assistants, remove the first one in the list
    assistantToRemove = assistants[0];
  }

  const assistantManagerRoleSetting = db.getSetting.get('assistant_manager_role');
  const assistantManagerId = assistantToRemove.discord_id;

  db.removeAssistantManagerByDiscordId.run(assistantManagerId, team.id);

  try {
    const member = await interaction.guild.members.fetch(assistantManagerId);
    await member.roles.remove(role.id);
    if (assistantManagerRoleSetting) {
      await member.roles.remove(assistantManagerRoleSetting.value);
    }
  } catch (error) {
    console.error('Error removing roles:', error);
  }

  return interaction.reply({ embeds: [createSuccessEmbed('Assistant Manager Removed', `<@${assistantManagerId}> is no longer an assistant manager of **${team.name}**.`)] });
}

async function handleSetAssistantManagerRole(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can set the assistant manager role.')], ephemeral: true });
  }

  const role = interaction.options.getRole('role');
  
  db.setSetting.run('assistant_manager_role', role.id);
  
  return interaction.reply({ embeds: [createSuccessEmbed('Assistant Manager Role Set', `${role} has been set as the global Assistant Manager role.`)] });
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

async function handleDemand(interaction) {
  const player = db.getPlayer.get(interaction.user.id);

  if (!player) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'You are not in the player database.')], ephemeral: true });
  }

  // Check if user is a manager or assistant manager (cannot demand)
  const isManager = db.getTeamByManagerId.get(interaction.user.id);
  const isAssistantManager = db.getTeamByAssistantManagerId.get(interaction.user.id);
  if (isManager || isAssistantManager) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Managers and assistant managers cannot use the demand command.')], ephemeral: true });
  }

  // Check transaction window
  const transactionWindowSetting = db.getSetting.get('transaction_window_open');
  const isWindowOpen = transactionWindowSetting && transactionWindowSetting.value === 'true';

  // Check if player has already used demand twice (only if window is closed)
  if (!isWindowOpen) {
    const demandUses = db.getPlayerDemandUses.get(interaction.user.id);
    if (demandUses && demandUses.demand_uses >= 2) {
      return interaction.reply({ embeds: [createErrorEmbed('Limit Reached', 'You have already used your 2 allowed demands. Contact an admin if you need further assistance.')], ephemeral: true });
    }
  }

  // Get player's team
  const playerTeams = db.getPlayerTeams.all(player.id);
  if (playerTeams.length === 0) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'You are not part of any team.')], ephemeral: true });
  }

  const team = playerTeams[0];

  // Send confirmation message
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`demand_confirm_${interaction.user.id}`)
        .setLabel('Confirm Demand')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`demand_cancel_${interaction.user.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

  const confirmEmbed = createSuccessEmbed('Confirm Demand',
    `Are you sure you want to be released from **${team.name}**?\n\nThis action cannot be undone.`);

  return interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });
}

async function handleAddPlayer(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can add players to teams.')], ephemeral: true });
  }

  const playerUser = interaction.options.getUser('player');
  const teamRole = interaction.options.getRole('team');

  if (playerUser.bot) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Cannot add bots to teams.')], ephemeral: true });
  }

  // Check if target is a manager
  const isManager = db.getTeamByManagerId.get(playerUser.id);
  if (isManager) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', `<@${playerUser.id}> is a manager and cannot be added as a player.`)], ephemeral: true });
  }

  // Check if target is already signed
  const playerRecord = db.getPlayer.get(playerUser.id);
  if (playerRecord) {
    const existingTeams = db.getPlayerTeams.all(playerRecord.id);
    if (existingTeams.length > 0) {
      const teamList = existingTeams.map(t => `**${t.name}**`).join(', ');
      return interaction.reply({ embeds: [createErrorEmbed('Error', `<@${playerUser.id}> is already signed to ${teamList}.`)], ephemeral: true });
    }
  }

  const team = db.getTeamByRoleId.get(teamRole.id);
  if (!team) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'No team found with this role.')], ephemeral: true });
  }

  try {
    db.createOrUpdatePlayer.run(playerUser.id, playerUser.username);
    const playerDb = db.getPlayer.get(playerUser.id);
    db.addMembership.run(playerDb.id, team.id, 'player', null, null);

    try {
      const member = await interaction.guild.members.fetch(playerUser.id);
      await member.roles.add(teamRole.id);
    } catch (error) {
      console.error('Error adding role:', error);
    }

    const transactionChannelSetting = db.getSetting.get('transactions_channel');
    if (transactionChannelSetting) {
      try {
        const channel = await interaction.guild.channels.fetch(transactionChannelSetting.value);
        if (channel) {
          const { EmbedBuilder } = require('discord.js');
          
          let contractorName = 'Unknown';
          try {
            const contractorUser = await interaction.guild.members.fetch(interaction.user.id);
            contractorName = contractorUser.user.username;
          } catch (e) {
            console.error('Error fetching admin:', e);
          }
          
          const unixTimestamp = Math.floor(Date.now() / 1000);
          const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Player Added')
            .setDescription(`<@${playerUser.id}> has been added to **${team.name}**`)
            .setThumbnail(playerUser.displayAvatarURL())
            .addFields(
              { name: 'Player', value: `<@${playerUser.id}>`, inline: true },
              { name: 'Team', value: team.name, inline: true },
              { name: 'Added by', value: contractorName, inline: true },
              { name: 'Added on', value: unixToTimestamp(unixTimestamp), inline: false }
            )
            .setTimestamp();
          await channel.send({ embeds: [embed] });
        }
      } catch (error) {
        console.error('Error logging transaction:', error);
      }
    }

    const successEmbed = createSuccessEmbed('Player Added', `<@${playerUser.id}> has been added to **${team.name}**.`);
    return interaction.reply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error adding player:', error);
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Failed to add player to team.')], ephemeral: true });
  }
}

async function handleRemovePlayer(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only administrators can remove players from teams.')], ephemeral: true });
  }

  const playerUser = interaction.options.getUser('player');
  const teamRole = interaction.options.getRole('team');

  const team = db.getTeamByRoleId.get(teamRole.id);
  if (!team) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'No team found with this role.')], ephemeral: true });
  }

  const playerRecord = db.getPlayer.get(playerUser.id);
  if (!playerRecord) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Player not found in database.')], ephemeral: true });
  }

  const membership = db.getMembership.get(playerRecord.id, team.id);
  if (!membership) {
    return interaction.reply({ embeds: [createErrorEmbed('Error', `<@${playerUser.id}> is not part of **${team.name}**.`)], ephemeral: true });
  }

  try {
    db.removeMembership.run(playerRecord.id, team.id);

    try {
      const member = await interaction.guild.members.fetch(playerUser.id);
      await member.roles.remove(teamRole.id);
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
            const contractorUser = await interaction.guild.members.fetch(interaction.user.id);
            contractorName = contractorUser.user.username;
          } catch (e) {
            console.error('Error fetching admin:', e);
          }
          
          const unixTimestamp = Math.floor(Date.now() / 1000);
          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Player Removed')
            .setDescription(`<@${playerUser.id}> has been removed from **${team.name}**`)
            .setThumbnail(playerUser.displayAvatarURL())
            .addFields(
              { name: 'Player', value: `<@${playerUser.id}>`, inline: true },
              { name: 'Team', value: team.name, inline: true },
              { name: 'Removed by', value: contractorName, inline: true },
              { name: 'Removed on', value: unixToTimestamp(unixTimestamp), inline: false }
            )
            .setTimestamp();
          await channel.send({ embeds: [embed] });
        }
      } catch (error) {
        console.error('Error logging transaction:', error);
      }
    }

    const successEmbed = createSuccessEmbed('Player Removed', `<@${playerUser.id}> has been removed from **${team.name}**.`);
    return interaction.reply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error removing player:', error);
    return interaction.reply({ embeds: [createErrorEmbed('Error', 'Failed to remove player from team.')], ephemeral: true });
  }
}

async function handleClearDatabase(interaction) {
  const AUTHORIZED_USER_ID = '1003592269212950598';
  
  if (interaction.user.id !== AUTHORIZED_USER_ID) {
    return interaction.reply({ embeds: [createErrorEmbed('Permission Denied', 'Only @san_z1 can clear the database.')], ephemeral: true });
  }

  const confirm1 = interaction.options.getBoolean('confirm1');
  const confirm2 = interaction.options.getBoolean('confirm2');
  const confirm3 = interaction.options.getBoolean('confirm3');
  const confirm4 = interaction.options.getBoolean('confirm4');

  if (!confirm1 || !confirm2 || !confirm3 || !confirm4) {
    return interaction.reply({ embeds: [createErrorEmbed('Confirmation Failed', 'All 4 confirmations must be set to TRUE to clear the database.')], ephemeral: true });
  }

  try {
    await interaction.deferReply({ ephemeral: true });

    // Clear all tables
    db.db.exec('DELETE FROM pending_offers;');
    db.db.exec('DELETE FROM memberships;');
    db.db.exec('DELETE FROM players;');
    db.db.exec('DELETE FROM referees;');
    db.db.exec('DELETE FROM teams;');
    db.db.exec('DELETE FROM matches;');
    db.db.exec('DELETE FROM settings;');

    const successEmbed = createSuccessEmbed('Database Cleared', 'All data has been permanently deleted from the database. The bot is now in a clean state.');
    return interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error clearing database:', error);
    return interaction.editReply({ embeds: [createErrorEmbed('Error', `Failed to clear database: ${error.message}`)] });
  }
}

module.exports = { command, execute };
