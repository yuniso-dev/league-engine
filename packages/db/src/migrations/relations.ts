import { relations } from "drizzle-orm/relations";
import { teams, tournaments, eventSignups, users, matches, matchParticipants, ratingHistory, awards, userAwards, adminActions, blacklistedUsers, teamMembers } from "./schema";

export const tournamentsRelations = relations(tournaments, ({one, many}) => ({
	team: one(teams, {
		fields: [tournaments.winnerTeamId],
		references: [teams.id],
		relationName: "tournaments_winnerTeamId_teams_id"
	}),
	eventSignups: many(eventSignups),
	teams: many(teams, {
		relationName: "teams_tournamentId_tournaments_id"
	}),
	matches: many(matches),
	userAwards: many(userAwards),
}));

export const teamsRelations = relations(teams, ({one, many}) => ({
	tournaments: many(tournaments, {
		relationName: "tournaments_winnerTeamId_teams_id"
	}),
	user: one(users, {
		fields: [teams.captainId],
		references: [users.discordId]
	}),
	tournament: one(tournaments, {
		fields: [teams.tournamentId],
		references: [tournaments.id],
		relationName: "teams_tournamentId_tournaments_id"
	}),
	matches_awayTeamId: many(matches, {
		relationName: "matches_awayTeamId_teams_id"
	}),
	matches_homeTeamId: many(matches, {
		relationName: "matches_homeTeamId_teams_id"
	}),
	matchParticipants: many(matchParticipants),
	teamMembers: many(teamMembers),
}));

export const eventSignupsRelations = relations(eventSignups, ({one}) => ({
	tournament: one(tournaments, {
		fields: [eventSignups.tournamentId],
		references: [tournaments.id]
	}),
	user: one(users, {
		fields: [eventSignups.userId],
		references: [users.discordId]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	eventSignups: many(eventSignups),
	teams: many(teams),
	matchParticipants: many(matchParticipants),
	ratingHistories: many(ratingHistory),
	userAwards: many(userAwards),
	adminActions_adminId: many(adminActions, {
		relationName: "adminActions_adminId_users_discordId"
	}),
	adminActions_targetUserId: many(adminActions, {
		relationName: "adminActions_targetUserId_users_discordId"
	}),
	blacklistedUsers: many(blacklistedUsers),
	teamMembers: many(teamMembers),
}));

export const matchesRelations = relations(matches, ({one, many}) => ({
	team_awayTeamId: one(teams, {
		fields: [matches.awayTeamId],
		references: [teams.id],
		relationName: "matches_awayTeamId_teams_id"
	}),
	team_homeTeamId: one(teams, {
		fields: [matches.homeTeamId],
		references: [teams.id],
		relationName: "matches_homeTeamId_teams_id"
	}),
	tournament: one(tournaments, {
		fields: [matches.tournamentId],
		references: [tournaments.id]
	}),
	matchParticipants: many(matchParticipants),
}));

export const matchParticipantsRelations = relations(matchParticipants, ({one}) => ({
	match: one(matches, {
		fields: [matchParticipants.matchId],
		references: [matches.id]
	}),
	team: one(teams, {
		fields: [matchParticipants.teamId],
		references: [teams.id]
	}),
	user: one(users, {
		fields: [matchParticipants.userId],
		references: [users.discordId]
	}),
}));

export const ratingHistoryRelations = relations(ratingHistory, ({one}) => ({
	user: one(users, {
		fields: [ratingHistory.userId],
		references: [users.discordId]
	}),
}));

export const userAwardsRelations = relations(userAwards, ({one}) => ({
	award: one(awards, {
		fields: [userAwards.awardId],
		references: [awards.id]
	}),
	tournament: one(tournaments, {
		fields: [userAwards.tournamentId],
		references: [tournaments.id]
	}),
	user: one(users, {
		fields: [userAwards.userId],
		references: [users.discordId]
	}),
}));

export const awardsRelations = relations(awards, ({many}) => ({
	userAwards: many(userAwards),
}));

export const adminActionsRelations = relations(adminActions, ({one}) => ({
	user_adminId: one(users, {
		fields: [adminActions.adminId],
		references: [users.discordId],
		relationName: "adminActions_adminId_users_discordId"
	}),
	user_targetUserId: one(users, {
		fields: [adminActions.targetUserId],
		references: [users.discordId],
		relationName: "adminActions_targetUserId_users_discordId"
	}),
}));

export const blacklistedUsersRelations = relations(blacklistedUsers, ({one}) => ({
	user: one(users, {
		fields: [blacklistedUsers.blacklistedBy],
		references: [users.discordId]
	}),
}));

export const teamMembersRelations = relations(teamMembers, ({one}) => ({
	team: one(teams, {
		fields: [teamMembers.teamId],
		references: [teams.id]
	}),
	user: one(users, {
		fields: [teamMembers.userId],
		references: [users.discordId]
	}),
}));