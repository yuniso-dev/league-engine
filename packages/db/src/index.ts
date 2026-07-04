export { getDb, closeDb, resetDb, runResilient } from './client';
export {
  listPlayersForNicknames,
  syncGuildMember,
  setUserInactive,
  listTrackedUsers,
  setRankingsRef,
} from './queries/bot';
export type { NicknamePlayer } from './queries/bot';
export * from './schema';
export { getRankings, searchRankings, recomputeRanks } from './queries/rankings';
export { getTournaments } from './queries/tournaments';
export {
  signUpForTournament,
  withdrawSignup,
  isSignedUp,
  getSignupsForTournament,
  getInVoicePublicIds,
  markAttendedIfSignedUp,
} from './queries/signups';
export type { PublicSignup } from './queries/signups';
export { getHallOfFame } from './queries/hallOfFame';
export type { HallAward, HallTournament } from './queries/hallOfFame';
export { getHealth } from './queries/health';
export type { HealthResult } from './queries/health';
export {
  upsertDiscordUser,
  getUserByDiscordId,
  getUserByPublicId,
  initialiseUser,
  ensurePublicId,
  updateSettings,
  updateOwnProfileFields,
} from './queries/users';
export type { UserRow } from './queries/users';
export {
  getDraftPool,
  addDiscordIdsToDraftPool,
  addToDraftPoolByPublicId,
  removeFromDraftPool,
  clearDraftPool,
} from './queries/draftPool';
export type { DraftPoolEntry } from './queries/draftPool';
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
  addTeamMember,
  removeTeamMember,
  setTeamCaptain,
  generateBracket,
  generateGroupStage,
  generateKnockoutFromTable,
  generateNextRound,
  recordMatchResult,
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
  listAwardsWithHolders,
  createAward,
  updateAward,
  getAdminAward,
  deleteAward,
  grantAward,
  revokeAward,
  listAwardsForPlayer,
} from './queries/awards';
export type {
  AwardRow,
  AdminAward,
  AdminAwardWithHolders,
  AdminAwardGrant,
  AdminAwardDetail,
  PublicAward,
} from './queries/awards';
export { getAdminStats } from './queries/adminStats';
export type { AdminStats } from './queries/adminStats';
export {
  getMatchStatsEntries,
  updateMatchStats,
  getTournamentStats,
  getAllTimeStats,
  getPlayerMilestones,
  computeGroupTable,
} from './queries/stats';
export type {
  MatchStatsEntry,
  MatchStatsSheet,
  StatLeader,
  StatLeaderboards,
  PlayerMilestones,
  LeagueTableRow,
} from './queries/stats';
export { getConfig, updateConfig } from './queries/config';
export type { ConfigRow } from './queries/config';
export { getTournamentDetail } from './queries/frontier';
export type {
  PublicTournamentDetail,
  PublicBracketTeam,
  PublicTeamMember,
  PublicBracketMatch,
} from './queries/frontier';
export { getRecentMatchesForPlayer } from './queries/profile';
export type { PublicRecentMatch } from './queries/profile';
export {
  listPlayersDirectory,
  getAdminPlayer,
  updatePlayerProfileByAdmin,
  updatePlayerIdentityByAdmin,
} from './queries/adminPlayers';
export {
  replaceVoicePresence,
  setVoicePresence,
  clearVoicePresence,
  getVoiceNow,
} from './queries/voice';
export type { VoiceNowEntry } from './queries/voice';
export type {
  AdminPlayerListItem,
  AdminPlayerAwardGrant,
  AdminPlayerDetail,
} from './queries/adminPlayers';
export { previewReveal, commitReveal, getRatingHistoryByPublicId } from './queries/reveal';
export type {
  RevealPreview,
  RevealPlayerPreview,
  RevealMatchPreview,
  RatingPoint,
} from './queries/reveal';
export { toPublicPlayer, toPublicTournament } from './dto';
export type { PublicPlayer, PublicTournament } from './dto';
