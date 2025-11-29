const { PermissionFlagsBits } = require('discord.js');
const db = require('../database');

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function isReferee(member) {
  const referee = db.getReferee.get(member.id);
  return !!referee;
}

function isRefereeOrAdmin(member) {
  return isAdmin(member) || isReferee(member);
}

function isManagerOfTeam(member, team) {
  if (!team) return false;
  if (team.manager_id === member.id) return true;
  
  const assistantManager = db.getAssistantManager.get(team.id, member.id);
  return !!assistantManager;
}

function isAssistantManagerOfTeam(member, team) {
  if (!team) return false;
  return team.assistant_manager_id === member.id;
}

function getManagerTeam(member) {
  const player = db.getPlayer.get(member.id);
  if (!player) return null;
  
  const teams = db.getPlayerTeams.all(player.id);
  const managerTeam = teams.find(t => t.role === 'manager');
  return managerTeam || null;
}

function hasTeamRole(member, roleId) {
  return member.roles.cache.has(roleId);
}

module.exports = {
  isAdmin,
  isReferee,
  isRefereeOrAdmin,
  isManagerOfTeam,
  isAssistantManagerOfTeam,
  getManagerTeam,
  hasTeamRole
};
