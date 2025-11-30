const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'league.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    short TEXT NOT NULL,
    role_id TEXT NOT NULL UNIQUE,
    manager_id TEXT,
    assistant_manager_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    mentions INTEGER DEFAULT 0,
    motm INTEGER DEFAULT 0,
    demand_uses INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('player', 'manager')),
    salary TEXT,
    duration TEXT,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(player_id, team_id)
  );

  CREATE TABLE IF NOT EXISTS referees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pending_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    team_id INTEGER NOT NULL,
    salary TEXT NOT NULL,
    duration TEXT NOT NULL,
    position TEXT,
    message_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    home_team_id INTEGER NOT NULL,
    away_team_id INTEGER NOT NULL,
    stadium TEXT NOT NULL,
    match_timestamp INTEGER NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'cancelled')),
    cancel_reason TEXT,
    fixtures_message_id TEXT,
    is_marked_done INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS assistant_managers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    team_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(discord_id, team_id)
  );
`);

// Add missing columns if they don't exist
try {
  db.exec(`ALTER TABLE players ADD COLUMN demand_uses INTEGER DEFAULT 0;`);
} catch (error) {
  // Column likely already exists, ignore the error
}

try {
  db.exec(`ALTER TABLE teams ADD COLUMN assistant_manager_id TEXT;`);
} catch (error) {
  // Column likely already exists, ignore the error
}

const createTeam = db.prepare(`
  INSERT INTO teams (name, short, role_id, manager_id) VALUES (?, ?, ?, ?)
`);

const deleteTeamByRoleId = db.prepare(`
  DELETE FROM teams WHERE role_id = ?
`);

const getTeamByRoleId = db.prepare(`
  SELECT * FROM teams WHERE role_id = ?
`);

const getTeamById = db.prepare(`
  SELECT * FROM teams WHERE id = ?
`);

const getAllTeams = db.prepare(`
  SELECT * FROM teams
`);

const setTeamManager = db.prepare(`
  UPDATE teams SET manager_id = ? WHERE id = ?
`);

const getTeamByManagerId = db.prepare(`
  SELECT * FROM teams WHERE manager_id = ?
`);

const getTeamByName = db.prepare(`
  SELECT * FROM teams WHERE name = ?
`);

const clearTeamManager = db.prepare(`
  UPDATE teams SET manager_id = NULL WHERE id = ?
`);

const setTeamAssistantManager = db.prepare(`
  UPDATE teams SET assistant_manager_id = ? WHERE id = ?
`);

const getTeamByAssistantManagerId = db.prepare(`
  SELECT * FROM teams WHERE assistant_manager_id = ?
`);

const clearTeamAssistantManager = db.prepare(`
  UPDATE teams SET assistant_manager_id = NULL WHERE id = ?
`);

const createOrUpdatePlayer = db.prepare(`
  INSERT INTO players (discord_id, name) VALUES (?, ?)
  ON CONFLICT(discord_id) DO UPDATE SET name = excluded.name
`);

const getPlayer = db.prepare(`
  SELECT * FROM players WHERE discord_id = ?
`);

const getPlayerById = db.prepare(`
  SELECT * FROM players WHERE id = ?
`);

const addMembership = db.prepare(`
  INSERT INTO memberships (player_id, team_id, role, salary, duration) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(player_id, team_id) DO UPDATE SET role = excluded.role, salary = excluded.salary, duration = excluded.duration
`);

const removeMembership = db.prepare(`
  DELETE FROM memberships WHERE player_id = ? AND team_id = ?
`);

const getMembership = db.prepare(`
  SELECT * FROM memberships WHERE player_id = ? AND team_id = ?
`);

const getTeamMembers = db.prepare(`
  SELECT p.*, m.role FROM players p
  JOIN memberships m ON p.id = m.player_id
  WHERE m.team_id = ?
`);

const getPlayerTeams = db.prepare(`
  SELECT t.*, m.role FROM teams t
  JOIN memberships m ON t.id = m.team_id
  WHERE m.player_id = ?
`);

const addReferee = db.prepare(`
  INSERT OR IGNORE INTO referees (discord_id) VALUES (?)
`);

const removeReferee = db.prepare(`
  DELETE FROM referees WHERE discord_id = ?
`);

const getReferee = db.prepare(`
  SELECT * FROM referees WHERE discord_id = ?
`);

const getAllReferees = db.prepare(`
  SELECT * FROM referees
`);

const setSetting = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const getSetting = db.prepare(`
  SELECT value FROM settings WHERE key = ?
`);

const updatePlayerStats = db.prepare(`
  UPDATE players SET goals = ?, assists = ?, mentions = ?, motm = ? WHERE discord_id = ?
`);

const getTopScorers = db.prepare(`
  SELECT * FROM players ORDER BY goals DESC LIMIT 10
`);

const getTopAssists = db.prepare(`
  SELECT * FROM players ORDER BY assists DESC LIMIT 10
`);

const createPendingOffer = db.prepare(`
  INSERT INTO pending_offers (player_id, team_id, salary, duration, position, message_id) VALUES (?, ?, ?, ?, ?, ?)
`);

const getPendingOffer = db.prepare(`
  SELECT * FROM pending_offers WHERE message_id = ?
`);

const deletePendingOffer = db.prepare(`
  DELETE FROM pending_offers WHERE message_id = ?
`);

const getPlayerPendingOffers = db.prepare(`
  SELECT * FROM pending_offers WHERE player_id = ?
`);

const createMatch = db.prepare(`
  INSERT INTO matches (home_team_id, away_team_id, stadium, match_timestamp) VALUES (?, ?, ?, ?)
`);

const getMatch = db.prepare(`
  SELECT m.*, ht.name as home_team_name, ht.short as home_team_short, at.name as away_team_name, at.short as away_team_short
  FROM matches m
  JOIN teams ht ON m.home_team_id = ht.id
  JOIN teams at ON m.away_team_id = at.id
  WHERE m.id = ?
`);

const updateMatch = db.prepare(`
  UPDATE matches SET home_team_id = ?, away_team_id = ?, stadium = ?, match_timestamp = ? WHERE id = ?
`);

const cancelMatch = db.prepare(`
  UPDATE matches SET status = 'cancelled', cancel_reason = ? WHERE id = ?
`);

const getAllUpcomingMatches = db.prepare(`
  SELECT m.*, ht.name as home_team_name, ht.short as home_team_short, ht.role_id as home_team_role_id, at.name as away_team_name, at.short as away_team_short, at.role_id as away_team_role_id
  FROM matches m
  JOIN teams ht ON m.home_team_id = ht.id
  JOIN teams at ON m.away_team_id = at.id
  WHERE m.status = 'scheduled'
  ORDER BY m.match_timestamp ASC
`);

const getFixturesMessage = db.prepare(`
  SELECT * FROM matches WHERE fixtures_message_id IS NOT NULL LIMIT 1
`);

const setFixturesMessage = db.prepare(`
  UPDATE matches SET fixtures_message_id = ? WHERE id = ?
`);

const clearFixturesMessage = db.prepare(`
  UPDATE matches SET fixtures_message_id = NULL
`);

const markFixturesAsDone = db.prepare(`
  UPDATE matches SET is_marked_done = 1 WHERE fixtures_message_id IS NOT NULL
`);

const deleteOldMatches = db.prepare(`
  DELETE FROM matches WHERE fixtures_message_id IS NULL
`);

const getLastFixturesMessage = db.prepare(`
  SELECT * FROM matches WHERE fixtures_message_id IS NOT NULL AND is_marked_done = 1 LIMIT 1
`);

const isFixturesMessageDone = db.prepare(`
  SELECT is_marked_done FROM matches WHERE fixtures_message_id IS NOT NULL LIMIT 1
`);

const incrementDemandUses = db.prepare(`
  UPDATE players SET demand_uses = demand_uses + 1 WHERE discord_id = ?
`);

const getPlayerDemandUses = db.prepare(`
  SELECT demand_uses FROM players WHERE discord_id = ?
`);

const getUnplayedMatches = db.prepare(`
  SELECT m.*, ht.name as home_team_name, ht.short as home_team_short, ht.role_id as home_team_role_id, at.name as away_team_name, at.short as away_team_short, at.role_id as away_team_role_id
  FROM matches m
  JOIN teams ht ON m.home_team_id = ht.id
  JOIN teams at ON m.away_team_id = at.id
  WHERE m.status = 'scheduled' AND m.is_marked_done = 0
  ORDER BY m.match_timestamp ASC
`);

const deleteMatch = db.prepare(`
  DELETE FROM matches WHERE id = ?
`);

const deleteAllMatches = db.prepare(`
  DELETE FROM matches
`);

const addAssistantManager = db.prepare(`
  INSERT INTO assistant_managers (discord_id, team_id) VALUES (?, ?)
`);

const getTeamAssistantManagers = db.prepare(`
  SELECT * FROM assistant_managers WHERE team_id = ?
`);

const removeAssistantManagerByDiscordId = db.prepare(`
  DELETE FROM assistant_managers WHERE discord_id = ? AND team_id = ?
`);

const getAssistantManagerTeams = db.prepare(`
  SELECT team_id FROM assistant_managers WHERE discord_id = ?
`);

const getAssistantManager = db.prepare(`
  SELECT * FROM assistant_managers WHERE team_id = ? AND discord_id = ?
`);

module.exports = {
  db,
  createTeam,
  deleteTeamByRoleId,
  getTeamByRoleId,
  getTeamById,
  getAllTeams,
  setTeamManager,
  getTeamByManagerId,
  getTeamByName,
  clearTeamManager,
  setTeamAssistantManager,
  getTeamByAssistantManagerId,
  clearTeamAssistantManager,
  createOrUpdatePlayer,
  getPlayer,
  getPlayerById,
  addMembership,
  removeMembership,
  getMembership,
  getTeamMembers,
  getPlayerTeams,
  addReferee,
  removeReferee,
  getReferee,
  getAllReferees,
  setSetting,
  getSetting,
  updatePlayerStats,
  getTopScorers,
  getTopAssists,
  createPendingOffer,
  getPendingOffer,
  deletePendingOffer,
  getPlayerPendingOffers,
  createMatch,
  getMatch,
  updateMatch,
  cancelMatch,
  getAllUpcomingMatches,
  getFixturesMessage,
  setFixturesMessage,
  clearFixturesMessage,
  markFixturesAsDone,
  deleteOldMatches,
  getLastFixturesMessage,
  isFixturesMessageDone,
  incrementDemandUses,
  getPlayerDemandUses,
  getUnplayedMatches,
  deleteMatch,
  deleteAllMatches,
  addAssistantManager,
  getTeamAssistantManagers,
  removeAssistantManagerByDiscordId,
  getAssistantManagerTeams,
  getAssistantManager
};
