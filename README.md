# Discord Soccer League Bot

A Discord bot for managing soccer league teams, players, referees, and match statistics using Node.js 18+ and discord.js v14 with an SQLite database.

## Overview

This bot provides comprehensive league management through slash commands, embeds, and button interactions. It handles team creation, player contracts, referee management, and detailed statistics tracking.

## Project Architecture

```
src/
├── index.js           # Main bot entry point, client setup, event handlers
├── database.js        # SQLite database module with all queries
├── commands/
│   ├── team.js        # Team management commands
│   ├── player.js      # Player management commands
│   ├── referee.js     # Referee management commands
│   └── stats.js       # Statistics commands
└── utils/
    ├── permissions.js # Permission checking utilities
    ├── embeds.js      # Discord embed builders
    └── logger.js      # Statistics change logger
```

## Database Schema

- **teams**: id, name, short, role_id, manager_id, created_at
- **players**: id, discord_id, name, goals, assists, mentions, motm
- **memberships**: player_id, team_id, role (player/manager), salary, duration
- **referees**: discord_id
- **settings**: key-value pairs (e.g., log channel)
- **pending_offers**: tracks contract offers sent via DM

## Commands

### Team Management
- `/team create name short role` - Create a team (Admin)
- `/team delete role` - Delete a team (Admin)
- `/team setmanagerrole role` - Set the global manager role (Admin) - **Must be set first!**
- `/team setmanager manager role` - Set team manager, gives them Manager role + team role (Admin)
- `/team removemanager role` - Remove a manager from a team (Admin)
- `/team offer player salary duration` - Send contract offer (Manager with Manager role + team role)
- `/team release player` - Release a player (Manager with Manager role + team role)
- `/team roster` - Show team roster

### Validations
- Cannot create two teams with the same name
- Cannot set the same player as manager for multiple teams
- Cannot set multiple managers for the same team
- Cannot send a contract offer to yourself
- Must remove existing manager before setting a new one

### Player Management
- `/player info player` - Show player stats

### Referee Management
- `/team setrefereerole role` - Set the global referee role (Admin) - **Must be set first!**
- `/referee set user` - Add referee and give them the role (Admin)
- `/referee remove user` - Remove referee and take away the role (Admin)
- `/referee list` - List all referees

### Statistics (Referees/Admins)
- `/stats logchannel channel` - Set log channel
- `/stats addgoal player` - Add goal
- `/stats removegoal player` - Remove goal (Admin only)
- `/stats addassist player` - Add assist
- `/stats removeassist player` - Remove assist (Admin only)
- `/stats addmention player1 [player2-5]` - Add mentions
- `/stats removemention player` - Remove mention
- `/stats addmotm player` - Add MOTM
- `/stats removemotm player` - Remove MOTM

### Member Stats Commands
- `/stats playerstats player` - Show player stats
- `/stats topscorers` - Top scorers leaderboard
- `/stats topplayermakers` - Top assists leaderboard

## Required Environment Variables

- `DISCORD_TOKEN` - Your Discord bot token (required)
- `GUILD_ID` - Server ID for guild-specific commands (optional, uses global if not set)

## Permissions

- **Admin**: Full access to all commands
- **Manager**: Can send offers, release players, view roster
- **Referee**: Can add goals, assists, mentions, MOTM
- **Member**: Can view stats and rosters

## Recent Changes

- Initial setup with full command implementation
- SQLite database with WAL mode for better performance
- Button interactions for contract offers via DM
- Automatic role assignment on contract acceptance
