export { getDb } from './client';
export * from './schema';
export { getRankings, searchRankings } from './queries/rankings';
export { getTournaments } from './queries/tournaments';
export { getHealth } from './queries/health';
export {
  upsertDiscordUser,
  getUserByDiscordId,
  getUserByPublicId,
  initialiseUser,
  updateSettings,
} from './queries/users';
export type { UserRow } from './queries/users';
export {
  MATCH_STAGES,
  getCurrentSeason,
  listAdminTournaments,
  createTournament,
  getTournamentById,
  updateTournament,
  deleteTournament,
  updateTournamentStatus,
  listPlayersForAdmin,
  getAdminTournament,
  createTeam,
  deleteTeam,
  createMatch,
  deleteMatch,
} from './queries/admin';
export type {
  TournamentRow,
  MatchStage,
  AdminPlayerOption,
  AdminTeam,
  AdminMatch,
  AdminTournamentDetail,
} from './queries/admin';
export {
  listAwardsForAdmin,
  createAward,
  getAdminAward,
  deleteAward,
  grantAward,
  revokeAward,
  listAwardsForPlayer,
} from './queries/awards';
export type {
  AwardRow,
  AdminAward,
  AdminAwardGrant,
  AdminAwardDetail,
  PublicAward,
} from './queries/awards';
export { getConfig, updateConfig } from './queries/config';
export type { ConfigRow } from './queries/config';
export { getTournamentDetail } from './queries/frontier';
export type {
  PublicTournamentDetail,
  PublicBracketTeam,
  PublicTeamMember,
  PublicBracketMatch,
} from './queries/frontier';
export { previewReveal, commitReveal, getRatingHistoryByPublicId } from './queries/reveal';
export type {
  RevealPreview,
  RevealPlayerPreview,
  RevealMatchPreview,
  RatingPoint,
} from './queries/reveal';
export { toPublicPlayer, toPublicTournament } from './dto';
export type { PublicPlayer, PublicTournament } from './dto';
