import { desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../client';
import { awards, teamMembers, teams, tournaments, userAwards, users } from '../schema';

// The Hall of Fame: every completed Frontier with its champion roster and the
// awards handed out for it, grouped by season on the page.

export type HallAward = {
  name: string;
  icon: string | null;
  imageUrl: string | null;
  playerName: string;
  playerPublicId: string | null;
};

export type HallTournament = {
  id: string;
  name: string;
  season: number;
  startDate: string | null;
  championTeam: string | null;
  championRoster: string[];
  awards: HallAward[];
};

export async function getHallOfFame(): Promise<HallTournament[]> {
  const db = getDb();

  const completed = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      season: tournaments.season,
      startDate: tournaments.startDate,
      winnerTeamId: tournaments.winnerTeamId,
      championTeam: teams.name,
    })
    .from(tournaments)
    .leftJoin(teams, eq(tournaments.winnerTeamId, teams.id))
    .where(eq(tournaments.status, 'completed'))
    .orderBy(desc(tournaments.season), desc(tournaments.createdAt));
  if (completed.length === 0) return [];

  const winnerTeamIds = completed
    .map(t => t.winnerTeamId)
    .filter((id): id is string => id != null);
  const tournamentIds = completed.map(t => t.id);

  const [rosterRows, awardRows] = await Promise.all([
    winnerTeamIds.length
      ? db
          .select({
            teamId: teamMembers.teamId,
            displayName: users.displayName,
          })
          .from(teamMembers)
          .innerJoin(users, eq(teamMembers.userId, users.discordId))
          .where(inArray(teamMembers.teamId, winnerTeamIds))
      : Promise.resolve([]),
    db
      .select({
        tournamentId: userAwards.tournamentId,
        name: awards.name,
        icon: awards.icon,
        imageUrl: awards.imageUrl,
        playerName: users.displayName,
        playerPublicId: users.publicId,
        awardedAt: userAwards.awardedAt,
      })
      .from(userAwards)
      .innerJoin(awards, eq(userAwards.awardId, awards.id))
      .innerJoin(users, eq(userAwards.userId, users.discordId))
      .where(inArray(userAwards.tournamentId, tournamentIds))
      .orderBy(desc(userAwards.awardedAt)),
  ]);

  const rosterOf = new Map<string, string[]>();
  for (const r of rosterRows) {
    const list = rosterOf.get(r.teamId) ?? [];
    list.push(r.displayName);
    rosterOf.set(r.teamId, list);
  }

  const awardsOf = new Map<string, HallAward[]>();
  for (const a of awardRows) {
    if (!a.tournamentId) continue;
    const list = awardsOf.get(a.tournamentId) ?? [];
    list.push({
      name: a.name,
      icon: a.icon,
      imageUrl: a.imageUrl,
      playerName: a.playerName,
      playerPublicId: a.playerPublicId,
    });
    awardsOf.set(a.tournamentId, list);
  }

  return completed.map(t => ({
    id: t.id,
    name: t.name,
    season: t.season,
    startDate: t.startDate,
    championTeam: t.championTeam,
    championRoster: t.winnerTeamId ? rosterOf.get(t.winnerTeamId) ?? [] : [],
    awards: awardsOf.get(t.id) ?? [],
  }));
}
