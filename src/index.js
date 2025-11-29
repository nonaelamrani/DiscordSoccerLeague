require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes, Collection, Events } = require('discord.js');
const db = require('./database');
const { createSuccessEmbed, createErrorEmbed } = require('./utils/embeds');

const teamCommand = require('./commands/team');
const playerCommand = require('./commands/player');
const refereeCommand = require('./commands/referee');
const statsCommand = require('./commands/stats');
const matchCommand = require('./commands/match');
const fixturesCommand = require('./commands/fixtures');
const transactionCommand = require('./commands/transaction');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

client.commands = new Collection();
client.commands.set('team', teamCommand);
client.commands.set('player', playerCommand);
client.commands.set('referee', refereeCommand);
client.commands.set('stats', statsCommand);
client.commands.set('match', matchCommand);
client.commands.set('fixtures', fixturesCommand);
client.commands.set('transaction', transactionCommand);

const commands = [
  teamCommand.command.toJSON(),
  playerCommand.command.toJSON(),
  refereeCommand.command.toJSON(),
  statsCommand.command.toJSON(),
  matchCommand.command.toJSON(),
  fixturesCommand.command.toJSON(),
  transactionCommand.command.toJSON()
];

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}!`);
  
  try {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    
    console.log('Started refreshing application (/) commands.');
    
    if (process.env.GUILD_ID) {
      console.log('Clearing old guild commands...');
      await rest.put(
        Routes.applicationGuildCommands(readyClient.user.id, process.env.GUILD_ID),
        { body: [] }
      );
      
      console.log('Registering new guild commands...');
      await rest.put(
        Routes.applicationGuildCommands(readyClient.user.id, process.env.GUILD_ID),
        { body: commands }
      );
      console.log(`Successfully registered commands for guild ${process.env.GUILD_ID}`);
    } else {
      console.log('Clearing old global commands...');
      await rest.put(
        Routes.applicationCommands(readyClient.user.id),
        { body: [] }
      );
      
      console.log('Registering new global commands...');
      await rest.put(
        Routes.applicationCommands(readyClient.user.id),
        { body: commands }
      );
      console.log('Successfully registered global commands.');
    }
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);
      
      const errorEmbed = createErrorEmbed('Error', 'There was an error while executing this command.');
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  } else if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
  }
});

async function handleButtonInteraction(interaction) {
  if (interaction.customId.startsWith('demand_')) {
    return handleDemandConfirmation(interaction);
  }

  const [action, decision, teamIdStr] = interaction.customId.split('_');
  
  if (action !== 'offer') return;

  try {
    const teamId = parseInt(teamIdStr);
    const team = db.getTeamById.get(teamId);
    
    if (!team) {
      return interaction.update({ 
        embeds: [createErrorEmbed('Error', 'This team no longer exists.')],
        components: []
      });
    }

    const offer = db.getPendingOffer.get(interaction.message.id);
    
    if (!offer) {
      return interaction.update({ 
        embeds: [createErrorEmbed('Error', 'This offer has expired or was already processed.')],
        components: []
      });
    }

    if (offer.player_id !== interaction.user.id) {
      return interaction.reply({ 
        embeds: [createErrorEmbed('Error', 'This offer is not for you.')],
        ephemeral: true
      });
    }

    if (decision === 'accept') {
      db.createOrUpdatePlayer.run(interaction.user.id, interaction.user.username);
      const player = db.getPlayer.get(interaction.user.id);
      
      db.addMembership.run(player.id, team.id, 'player', offer.salary, offer.duration);
      
      try {
        const guild = client.guilds.cache.find(g => {
          const role = g.roles.cache.get(team.role_id);
          return !!role;
        });
        
        if (guild) {
          const member = await guild.members.fetch(interaction.user.id);
          await member.roles.add(team.role_id);
        }
      } catch (roleError) {
        console.error('Error adding team role:', roleError);
      }
      
      db.deletePendingOffer.run(interaction.message.id);

      const transactionChannelSetting = db.getSetting.get('transactions_channel');
      if (transactionChannelSetting) {
        try {
          const channel = await client.channels.fetch(transactionChannelSetting.value);
          if (channel) {
            const { EmbedBuilder } = require('discord.js');
            
            let contractorName = 'Unknown';
            try {
              const contractorUser = await client.users.fetch(team.manager_id);
              contractorName = contractorUser.username;
            } catch (e) {
              console.error('Error fetching contractor:', e);
            }
            
            const embed = new EmbedBuilder()
              .setColor(0x00FF00)
              .setTitle('✅ Contract Accepted')
              .setDescription(`<@${interaction.user.id}> has successfully signed with **${team.name}**`)
              .setThumbnail(interaction.user.displayAvatarURL())
              .addFields(
                { name: 'Signee', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Team', value: team.name, inline: true },
                { name: 'Contractor', value: contractorName, inline: true },
                { name: 'Position', value: offer.position, inline: true },
                { name: 'Salary', value: offer.salary, inline: true },
                { name: 'Duration', value: offer.duration, inline: true },
                { name: 'Signed on', value: new Date().toLocaleString(), inline: false }
              )
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch (error) {
          console.error('Error logging transaction:', error);
        }
      }
      
      return interaction.update({
        embeds: [createSuccessEmbed('Contract Accepted', `You have joined **${team.name}**!\n\nSalary: ${offer.salary}\nDuration: ${offer.duration}`)],
        components: []
      });
    } else if (decision === 'decline') {
      db.deletePendingOffer.run(interaction.message.id);
      
      return interaction.update({
        embeds: [createErrorEmbed('Contract Declined', `You have declined the offer from **${team.name}**.`)],
        components: []
      });
    }
  } catch (error) {
    console.error('Error handling button interaction:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      return interaction.update({
        embeds: [createErrorEmbed('Error', 'An error occurred while processing your response.')],
        components: []
      });
    }
  }
}

async function handleDemandConfirmation(interaction) {
  const [, decision, userId] = interaction.customId.split('_');

  if (interaction.user.id !== userId) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'This confirmation is not for you.')],
      ephemeral: true
    });
  }

  if (decision === 'confirm') {
    try {
      const player = db.getPlayer.get(userId);
      if (!player) {
        return interaction.update({
          embeds: [createErrorEmbed('Error', 'Player not found.')],
          components: []
        });
      }

      const playerTeams = db.getPlayerTeams.all(player.id);
      if (playerTeams.length === 0) {
        return interaction.update({
          embeds: [createErrorEmbed('Error', 'You are not part of any team.')],
          components: []
        });
      }

      const team = playerTeams[0];
      db.removeMembership.run(player.id, team.id);
      db.incrementDemandUses.run(userId);

      try {
        const member = await interaction.guild.members.fetch(userId);
        await member.roles.remove(team.role_id);
      } catch (error) {
        console.error('Error removing role:', error);
      }

      const transactionChannelSetting = db.getSetting.get('transactions_channel');
      if (transactionChannelSetting) {
        try {
          const channel = await client.channels.fetch(transactionChannelSetting.value);
          if (channel) {
            const { EmbedBuilder } = require('discord.js');
            const unixTimestamp = Math.floor(Date.now() / 1000);
            const { unixToTimestamp } = require('./utils/timestamps');
            const embed = new EmbedBuilder()
              .setColor(0xFFA500)
              .setTitle('⚠️ Player Demanded Release')
              .setDescription(`<@${userId}> has been released from **${team.name}** via demand`)
              .setThumbnail(interaction.user.displayAvatarURL())
              .addFields(
                { name: 'Player', value: `<@${userId}>`, inline: true },
                { name: 'Team', value: team.name, inline: true },
                { name: 'Action', value: 'Demand', inline: true },
                { name: 'Released on', value: unixToTimestamp(unixTimestamp), inline: false }
              )
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch (error) {
          console.error('Error logging demand transaction:', error);
        }
      }

      const demandUses = db.getPlayerDemandUses.get(userId);
      return interaction.update({
        embeds: [createSuccessEmbed('Released from Team',
          `You have been released from **${team.name}**.`)],
        components: []
      });
    } catch (error) {
      console.error('Error processing demand confirmation:', error);
      return interaction.update({
        embeds: [createErrorEmbed('Error', 'Failed to process demand.')],
        components: []
      });
    }
  } else if (decision === 'cancel') {
    return interaction.update({
      embeds: [createErrorEmbed('Demand Cancelled', 'You have cancelled your demand.')],
      components: []
    });
  }
}

if (!process.env.DISCORD_TOKEN) {
  console.error('ERROR: DISCORD_TOKEN environment variable is not set!');
  console.log('Please set your Discord bot token as an environment variable.');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
