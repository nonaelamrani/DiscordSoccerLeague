const db = require('../database');

async function logStatChange(client, action, player, modifier, oldValue, newValue) {
  const logChannelSetting = db.getSetting.get('log_channel');
  if (!logChannelSetting) return;

  try {
    const channel = await client.channels.fetch(logChannelSetting.value);
    if (!channel) return;

    const message = `**${action}** | Player: <@${player.discord_id}> | By: <@${modifier}> | ${oldValue} -> ${newValue}`;
    await channel.send(message);
  } catch (error) {
    console.error('Failed to log stat change:', error);
  }
}

module.exports = {
  logStatChange
};
