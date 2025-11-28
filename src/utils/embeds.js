const { EmbedBuilder } = require('discord.js');

function createSuccessEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function createInfoEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function createPlayerStatsEmbed(player, member) {
  return new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(`Player Stats: ${player.name}`)
    .setThumbnail(member?.displayAvatarURL() || null)
    .addFields(
      { name: 'Goals', value: `${player.goals}`, inline: true },
      { name: 'Assists', value: `${player.assists}`, inline: true },
      { name: 'Mentions', value: `${player.mentions}`, inline: true },
      { name: 'MOTM', value: `${player.motm}`, inline: true }
    )
    .setTimestamp();
}

function createRosterEmbed(team, members, guild) {
  const managers = members.filter(m => m.role === 'manager');
  const players = members.filter(m => m.role === 'player');

  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(`${team.name} [${team.short}] Roster`)
    .setTimestamp();

  const managerInfo = [];
  if (team.manager_id) managerInfo.push(`**Manager:** <@${team.manager_id}>`);
  if (team.assistant_manager_id) managerInfo.push(`**Assistant Manager:** <@${team.assistant_manager_id}>`);
  
  if (managerInfo.length > 0) {
    embed.addFields({ name: 'Leadership', value: managerInfo.join('\n'), inline: false });
  }

  if (players.length > 0) {
    const playerList = players.map(m => `<@${m.discord_id}>`).join('\n');
    embed.addFields({ name: 'Players', value: playerList, inline: false });
  }

  if (team.manager_id === null && team.assistant_manager_id === null && members.length === 0) {
    embed.setDescription('No team leadership or members assigned yet.');
  }

  return embed;
}

function createOfferEmbed(team, salary, duration, position) {
  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('Contract Offer')
    .setDescription(`You have received a contract offer from **${team.name}**!`)
    .addFields(
      { name: 'Team', value: team.name, inline: true },
      { name: 'Position', value: position, inline: true },
      { name: 'Salary', value: salary, inline: true },
      { name: 'Duration', value: duration, inline: true }
    )
    .setFooter({ text: 'Click Accept to join or Decline to reject' })
    .setTimestamp();
}

function createTopScorersEmbed(players) {
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('Top Scorers')
    .setTimestamp();

  if (players.length === 0) {
    embed.setDescription('No players with goals yet.');
  } else {
    const list = players.map((p, i) => `${i + 1}. <@${p.discord_id}> - **${p.goals}** goals`).join('\n');
    embed.setDescription(list);
  }

  return embed;
}

function createTopPlaymakersEmbed(players) {
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('Top Playmakers')
    .setTimestamp();

  if (players.length === 0) {
    embed.setDescription('No players with assists yet.');
  } else {
    const list = players.map((p, i) => `${i + 1}. <@${p.discord_id}> - **${p.assists}** assists`).join('\n');
    embed.setDescription(list);
  }

  return embed;
}

function createRefereesEmbed(referees) {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Referees')
    .setTimestamp();

  if (referees.length === 0) {
    embed.setDescription('No referees registered yet.');
  } else {
    const list = referees.map(r => `<@${r.discord_id}>`).join('\n');
    embed.setDescription(list);
  }

  return embed;
}

function createFixturesEmbed(matches) {
  const { unixToTimestamp, unixToDateString } = require('./timestamps');
  const embed = new EmbedBuilder()
    .setColor(0xFF6B00)
    .setTitle('⚽ UPCOMING FIXTURES ⚽')
    .setDescription('━━━━━━━━━━━━━━━━━━━━━━')
    .setTimestamp();

  if (matches.length === 0) {
    embed.setDescription('No upcoming matches scheduled.');
    return embed;
  }

  // Group matches by date
  const matchesByDate = {};
  matches.forEach(match => {
    const dateStr = unixToDateString(match.match_timestamp);
    if (!matchesByDate[dateStr]) {
      matchesByDate[dateStr] = [];
    }
    matchesByDate[dateStr].push(match);
  });

  // Add fields for each date
  Object.keys(matchesByDate).sort().forEach(date => {
    const dateMatches = matchesByDate[date];
    const matchLines = dateMatches.map(m => 
      `🕐 ${unixToTimestamp(m.match_timestamp)}\n<@&${m.home_team_role_id}> ⚽ <@&${m.away_team_role_id}>\n🏟️ ${m.stadium}`
    ).join('\n\n');
    
    embed.addFields({
      name: `📅 ${date}`,
      value: matchLines,
      inline: false
    });
  });

  embed.setFooter({ text: '⚽ All times shown in your local timezone ⚽' });
  return embed;
}

function createFixturesDoneEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ FIXTURES COMPLETED ✅')
    .setDescription('All fixtures have been completed and archived.')
    .setTimestamp();
  
  return embed;
}

module.exports = {
  createSuccessEmbed,
  createErrorEmbed,
  createInfoEmbed,
  createPlayerStatsEmbed,
  createRosterEmbed,
  createOfferEmbed,
  createTopScorersEmbed,
  createTopPlaymakersEmbed,
  createRefereesEmbed,
  createFixturesEmbed,
  createFixturesDoneEmbed
};
