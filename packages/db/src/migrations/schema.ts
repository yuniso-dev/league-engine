import { pgTable, type AnyPgColumn, foreignKey, uuid, text, integer, boolean, date, timestamp, index, unique, varchar, numeric, jsonb, primaryKey, pgEnum } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"

export const accountTier = pgEnum("account_tier", ['free', 'premium'])
export const matchResult = pgEnum("match_result", ['win', 'loss', 'draw'])
export const matchStage = pgEnum("match_stage", ['group', 'round_of_16', 'quarter', 'semi', 'final', 'third_place', 'friendly'])
export const tournamentStatus = pgEnum("tournament_status", ['upcoming', 'live', 'completed'])
export const userRole = pgEnum("user_role", ['owner', 'admin', 'member'])



export const tournaments = pgTable("tournaments", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	name: text("name").notNull(),
	season: integer("season").notNull(),
	status: tournamentStatus("status").default('upcoming').notNull(),
	ranked: boolean("ranked").default(true).notNull(),
	startDate: date("start_date"),
	endDate: date("end_date"),
	winnerTeamId: uuid("winner_team_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		fkTournamentsWinnerTeam: foreignKey({
			columns: [table.winnerTeamId],
			foreignColumns: [teams.id],
			name: "fk_tournaments_winner_team"
		}).onDelete("set null"),
	}
});

export const eventSignups = pgTable("event_signups", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tournamentId: uuid("tournament_id").notNull(),
	userId: text("user_id").notNull(),
	signedUpAt: timestamp("signed_up_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	source: text("source").default('discord').notNull(),
	attended: boolean("attended"),
},
(table) => {
	return {
		idxSignupsTournament: index("idx_signups_tournament").using("btree", table.tournamentId.asc().nullsLast()),
		idxSignupsUser: index("idx_signups_user").using("btree", table.userId.asc().nullsLast()),
		eventSignupsTournamentIdFkey: foreignKey({
			columns: [table.tournamentId],
			foreignColumns: [tournaments.id],
			name: "event_signups_tournament_id_fkey"
		}).onDelete("cascade"),
		eventSignupsUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.discordId],
			name: "event_signups_user_id_fkey"
		}).onDelete("cascade"),
		eventSignupsTournamentIdUserIdKey: unique("event_signups_tournament_id_user_id_key").on(table.tournamentId, table.userId),
	}
});

export const users = pgTable("users", {
	discordId: text("discord_id").primaryKey().notNull(),
	username: text("username").notNull(),
	displayName: text("display_name").notNull(),
	avatarUrl: text("avatar_url"),
	position1: varchar("position1", { length: 3 }),
	position2: varchar("position2", { length: 3 }),
	hidePositions: boolean("hide_positions").default(false).notNull(),
	showUsername: boolean("show_username").default(true).notNull(),
	elo: numeric("elo", { precision: 7, scale:  2 }).default('1000').notNull(),
	rank: integer("rank"),
	provisional: boolean("provisional").default(true).notNull(),
	gamesPlayed: integer("games_played").default(0).notNull(),
	peakElo: numeric("peak_elo", { precision: 7, scale:  2 }),
	peakRank: integer("peak_rank"),
	initialised: boolean("initialised").default(false).notNull(),
	initialisedAt: timestamp("initialised_at", { withTimezone: true, mode: 'string' }),
	lastActiveAt: timestamp("last_active_at", { withTimezone: true, mode: 'string' }),
	isInactive: boolean("is_inactive").default(false).notNull(),
	eventsSignedUp: integer("events_signed_up").default(0).notNull(),
	eventsAttended: integer("events_attended").default(0).notNull(),
	country: varchar("country", { length: 2 }),
	quote: text("quote"),
	bio: text("bio"),
	role: userRole("role").default('member').notNull(),
	tier: accountTier("tier").default('free').notNull(),
	isBlacklisted: boolean("is_blacklisted").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	publicId: text("public_id"),
},
(table) => {
	return {
		idxUsersActiveLadder: index("idx_users_active_ladder").using("btree", table.initialised.asc().nullsLast(), table.isInactive.asc().nullsLast()),
		idxUsersElo: index("idx_users_elo").using("btree", table.elo.desc().nullsFirst()),
		idxUsersRank: index("idx_users_rank").using("btree", table.rank.asc().nullsLast()),
		usersPublicIdKey: unique("users_public_id_key").on(table.publicId),
	}
});

export const teams = pgTable("teams", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tournamentId: uuid("tournament_id").notNull(),
	name: text("name").notNull(),
	captainId: text("captain_id"),
	placement: integer("placement"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxTeamsTournament: index("idx_teams_tournament").using("btree", table.tournamentId.asc().nullsLast()),
		teamsCaptainIdFkey: foreignKey({
			columns: [table.captainId],
			foreignColumns: [users.discordId],
			name: "teams_captain_id_fkey"
		}),
		teamsTournamentIdFkey: foreignKey({
			columns: [table.tournamentId],
			foreignColumns: [tournaments.id],
			name: "teams_tournament_id_fkey"
		}).onDelete("cascade"),
	}
});

export const matches = pgTable("matches", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tournamentId: uuid("tournament_id").notNull(),
	homeTeamId: uuid("home_team_id").notNull(),
	awayTeamId: uuid("away_team_id").notNull(),
	homeScore: integer("home_score"),
	awayScore: integer("away_score"),
	stage: matchStage("stage").default('group').notNull(),
	ranked: boolean("ranked").default(true).notNull(),
	playedAt: timestamp("played_at", { withTimezone: true, mode: 'string' }),
	processed: boolean("processed").default(false).notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxMatchesTournament: index("idx_matches_tournament").using("btree", table.tournamentId.asc().nullsLast()),
		idxMatchesUnprocessed: index("idx_matches_unprocessed").using("btree", table.processed.asc().nullsLast()).where(sql`(processed = false)`),
		matchesAwayTeamIdFkey: foreignKey({
			columns: [table.awayTeamId],
			foreignColumns: [teams.id],
			name: "matches_away_team_id_fkey"
		}),
		matchesHomeTeamIdFkey: foreignKey({
			columns: [table.homeTeamId],
			foreignColumns: [teams.id],
			name: "matches_home_team_id_fkey"
		}),
		matchesTournamentIdFkey: foreignKey({
			columns: [table.tournamentId],
			foreignColumns: [tournaments.id],
			name: "matches_tournament_id_fkey"
		}).onDelete("cascade"),
	}
});

export const matchParticipants = pgTable("match_participants", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	matchId: uuid("match_id").notNull(),
	userId: text("user_id").notNull(),
	teamId: uuid("team_id").notNull(),
	result: matchResult("result"),
	goals: integer("goals").default(0).notNull(),
	assists: integer("assists").default(0).notNull(),
	cleanSheet: boolean("clean_sheet").default(false).notNull(),
	eloBefore: numeric("elo_before", { precision: 7, scale:  2 }),
	eloAfter: numeric("elo_after", { precision: 7, scale:  2 }),
	eloChange: numeric("elo_change", { precision: 6, scale:  2 }),
},
(table) => {
	return {
		idxMpMatch: index("idx_mp_match").using("btree", table.matchId.asc().nullsLast()),
		idxMpUser: index("idx_mp_user").using("btree", table.userId.asc().nullsLast()),
		matchParticipantsMatchIdFkey: foreignKey({
			columns: [table.matchId],
			foreignColumns: [matches.id],
			name: "match_participants_match_id_fkey"
		}).onDelete("cascade"),
		matchParticipantsTeamIdFkey: foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "match_participants_team_id_fkey"
		}),
		matchParticipantsUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.discordId],
			name: "match_participants_user_id_fkey"
		}),
		matchParticipantsMatchIdUserIdKey: unique("match_participants_match_id_user_id_key").on(table.matchId, table.userId),
	}
});

export const ratingHistory = pgTable("rating_history", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	elo: numeric("elo", { precision: 7, scale:  2 }).notNull(),
	rank: integer("rank"),
	gamesPlayed: integer("games_played").notNull(),
	weekOf: date("week_of").notNull(),
	eloChange: numeric("elo_change", { precision: 6, scale:  2 }),
	rankChange: integer("rank_change"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxHistoryUserWeek: index("idx_history_user_week").using("btree", table.userId.asc().nullsLast(), table.weekOf.asc().nullsLast()),
		ratingHistoryUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.discordId],
			name: "rating_history_user_id_fkey"
		}).onDelete("cascade"),
		ratingHistoryUserIdWeekOfKey: unique("rating_history_user_id_week_of_key").on(table.userId, table.weekOf),
	}
});

export const userAwards = pgTable("user_awards", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	awardId: uuid("award_id").notNull(),
	tournamentId: uuid("tournament_id"),
	season: integer("season"),
	awardedAt: timestamp("awarded_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		userAwardsAwardIdFkey: foreignKey({
			columns: [table.awardId],
			foreignColumns: [awards.id],
			name: "user_awards_award_id_fkey"
		}),
		userAwardsTournamentIdFkey: foreignKey({
			columns: [table.tournamentId],
			foreignColumns: [tournaments.id],
			name: "user_awards_tournament_id_fkey"
		}),
		userAwardsUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.discordId],
			name: "user_awards_user_id_fkey"
		}).onDelete("cascade"),
	}
});

export const awards = pgTable("awards", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	name: text("name").notNull(),
	icon: text("icon"),
	description: text("description"),
});

export const config = pgTable("config", {
	id: integer("id").default(1).primaryKey().notNull(),
	currentSeason: integer("current_season").default(1).notNull(),
	guildId: text("guild_id"),
	rankingsMessageId: text("rankings_message_id"),
	eloBase: numeric("elo_base", { precision: 7, scale:  2 }).default('1000').notNull(),
	kPlacement: integer("k_placement").default(60).notNull(),
	kEstablished: integer("k_established").default(24).notNull(),
	placementGames: integer("placement_games").default(5).notNull(),
	decayWeeks: integer("decay_weeks").default(4).notNull(),
	movMultiplierCap: numeric("mov_multiplier_cap", { precision: 4, scale:  2 }).default('1.75').notNull(),
	lastRevealAt: timestamp("last_reveal_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const adminActions = pgTable("admin_actions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	adminId: text("admin_id").notNull(),
	action: text("action").notNull(),
	targetUserId: text("target_user_id"),
	details: jsonb("details"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		adminActionsAdminIdFkey: foreignKey({
			columns: [table.adminId],
			foreignColumns: [users.discordId],
			name: "admin_actions_admin_id_fkey"
		}),
		adminActionsTargetUserIdFkey: foreignKey({
			columns: [table.targetUserId],
			foreignColumns: [users.discordId],
			name: "admin_actions_target_user_id_fkey"
		}),
	}
});

export const blacklistedUsers = pgTable("blacklisted_users", {
	discordId: text("discord_id").primaryKey().notNull(),
	reason: text("reason"),
	blacklistedBy: text("blacklisted_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		blacklistedUsersBlacklistedByFkey: foreignKey({
			columns: [table.blacklistedBy],
			foreignColumns: [users.discordId],
			name: "blacklisted_users_blacklisted_by_fkey"
		}),
	}
});

export const teamMembers = pgTable("team_members", {
	teamId: uuid("team_id").notNull(),
	userId: text("user_id").notNull(),
},
(table) => {
	return {
		idxTeamMembersUser: index("idx_team_members_user").using("btree", table.userId.asc().nullsLast()),
		teamMembersTeamIdFkey: foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "team_members_team_id_fkey"
		}).onDelete("cascade"),
		teamMembersUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.discordId],
			name: "team_members_user_id_fkey"
		}),
		teamMembersPkey: primaryKey({ columns: [table.teamId, table.userId], name: "team_members_pkey"}),
	}
});