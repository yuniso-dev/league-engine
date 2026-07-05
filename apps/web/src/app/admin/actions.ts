'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  MATCH_STAGES,
  addTeamMember,
  addToDraftPoolByPublicId,
  clearDraftPool,
  commitReveal,
  createAward,
  createMatch,
  createTeam,
  createTournament,
  deleteAward,
  deleteMatch,
  deleteTeam,
  deleteTournament,
  generateBracket,
  generateGroupStage,
  generateKnockoutFromTable,
  generateNextRound,
  getTournamentById,
  getTournamentDetail,
  grantAward,
  recomputeRanks,
  recordMatchResult,
  removeFromDraftPool,
  updateMatchStats,
  removeTeamMember,
  revokeAward,
  setTeamCaptain,
  updateAward,
  updateConfig,
  updatePlayerIdentityByAdmin,
  updatePlayerProfileByAdmin,
  updateTournament,
  updateTournamentStatus,
  type MatchStage,
} from '@inazuma/db';
import { requireAdminAction } from '@/lib/admin';
import {
  announceAward,
  announceChampion,
  announceKickoff,
  announceSignupsOpen,
} from '@/lib/announce';

// All admin forms use useFormState so validation problems surface inline.
export type AdminFormState = { error?: string; ok?: boolean; message?: string };

function message(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.';
}

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) ?? '').trim();
}

export async function createTournamentAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  let id: string;
  try {
    const admin = await requireAdminAction();

    const name = str(formData, 'name').slice(0, 80);
    if (!name) return { error: 'Name is required.' };

    const season = parseInt(str(formData, 'season'), 10);
    if (!Number.isInteger(season) || season < 1) return { error: 'Season must be a positive number.' };

    id = await createTournament(admin.discordId, {
      name,
      season,
      ranked: formData.get('ranked') === 'on',
      date: str(formData, 'date') || null,
    });
    // New Frontier opens as 'upcoming' with signups live — announce it.
    await announceSignupsOpen({ id, name, season });
  } catch (e) {
    return { error: message(e) };
  }
  redirect(`/admin/tournaments/${id}`);
}

export async function updateTournamentAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const tournamentId = str(formData, 'tournamentId');
  try {
    const admin = await requireAdminAction();
    if (!tournamentId) return { error: 'Missing tournament.' };

    const name = str(formData, 'name').slice(0, 80);
    if (!name) return { error: 'Name is required.' };

    const season = parseInt(str(formData, 'season'), 10);
    if (!Number.isInteger(season) || season < 1) return { error: 'Season must be a positive number.' };

    await updateTournament(admin.discordId, tournamentId, {
      name,
      season,
      ranked: formData.get('ranked') === 'on',
      date: str(formData, 'date') || null,
    });
  } catch (e) {
    return { error: message(e) };
  }
  redirect(`/admin/tournaments/${tournamentId}`);
}

export async function deleteTournamentAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const tournamentId = str(formData, 'tournamentId');
  try {
    const admin = await requireAdminAction();
    if (!tournamentId) return { error: 'Missing tournament.' };

    await deleteTournament(admin.discordId, tournamentId);
  } catch (e) {
    return { error: message(e) };
  }
  redirect('/admin');
}

export async function updateTournamentStatusAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const tournamentId = str(formData, 'tournamentId');
    const status = str(formData, 'status');
    if (!tournamentId || !['upcoming', 'live', 'completed'].includes(status)) {
      return { error: 'Invalid status.' };
    }

    const winnerTeamId = str(formData, 'winnerTeamId') || null;
    await updateTournamentStatus(
      admin.discordId,
      tournamentId,
      status as 'upcoming' | 'live' | 'completed',
      status === 'completed' ? winnerTeamId : null,
    );

    // Announce the two moments that matter: kickoff and the champion.
    if (status === 'live') {
      const t = await getTournamentById(tournamentId);
      if (t) await announceKickoff({ id: t.id, name: t.name, season: t.season });
    } else if (status === 'completed' && winnerTeamId) {
      const d = await getTournamentDetail(tournamentId);
      if (d?.tournament.winnerName) {
        await announceChampion({
          id: tournamentId,
          name: d.tournament.name,
          season: d.tournament.season,
          champion: d.tournament.winnerName,
        });
      }
    }

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    revalidatePath('/admin');
    revalidatePath('/hall-of-fame');
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function createTeamAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const tournamentId = str(formData, 'tournamentId');
    const name = str(formData, 'name').slice(0, 50);
    if (!tournamentId || !name) return { error: 'Team name is required.' };

    const memberPublicIds = formData.getAll('members').map(String);
    await createTeam(admin.discordId, { tournamentId, name, memberPublicIds });

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function deleteTeamAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const teamId = str(formData, 'teamId');
    const tournamentId = str(formData, 'tournamentId');
    if (!teamId) return { error: 'Missing team.' };

    await deleteTeam(admin.discordId, teamId);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function createMatchAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const tournamentId = str(formData, 'tournamentId');
    const homeTeamId = str(formData, 'homeTeamId');
    const awayTeamId = str(formData, 'awayTeamId');
    if (!tournamentId || !homeTeamId || !awayTeamId) return { error: 'Pick both teams.' };

    const homeScore = parseInt(str(formData, 'homeScore'), 10);
    const awayScore = parseInt(str(formData, 'awayScore'), 10);
    if (!Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0) {
      return { error: 'Enter a valid scoreline.' };
    }

    const stage = str(formData, 'stage');
    if (!(MATCH_STAGES as readonly string[]).includes(stage)) return { error: 'Invalid stage.' };

    const playedAtRaw = str(formData, 'playedAt');
    const playedAt = playedAtRaw ? new Date(playedAtRaw) : new Date();
    if (Number.isNaN(playedAt.getTime())) return { error: 'Invalid played-at date.' };

    const homePlayerPublicIds = formData.getAll('homePlayers').map(String);
    const awayPlayerPublicIds = formData.getAll('awayPlayers').map(String);
    if (homePlayerPublicIds.length === 0 || awayPlayerPublicIds.length === 0) {
      return { error: 'Select the players who took part on each side.' };
    }

    await createMatch(admin.discordId, {
      tournamentId,
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
      stage: stage as MatchStage,
      ranked: formData.get('ranked') === 'on',
      playedAt,
      homePlayerPublicIds,
      awayPlayerPublicIds,
    });

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function deleteMatchAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const matchId = str(formData, 'matchId');
    const tournamentId = str(formData, 'tournamentId');
    if (!matchId) return { error: 'Missing match.' };

    await deleteMatch(admin.discordId, matchId);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function commitRevealAction(
  _prev: AdminFormState,
  _formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const { matches, players } = await commitReveal(admin.discordId);
    if (matches === 0) return { error: 'Nothing to process — no pending ranked matches.' };

    revalidatePath('/admin/reveal');
    revalidatePath('/');
    return {
      ok: true,
      message: `Reveal committed — ${matches} match${matches === 1 ? '' : 'es'}, ${players} player${players === 1 ? '' : 's'} updated.`,
    };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function createAwardAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const name = str(formData, 'name').slice(0, 60);
    if (!name) return { error: 'Name is required.' };

    const icon = str(formData, 'icon').slice(0, 8) || null;
    const description = str(formData, 'description').slice(0, 200) || null;

    const imageUrlRaw = str(formData, 'imageUrl').slice(0, 500);
    let imageUrl: string | null = null;
    if (imageUrlRaw) {
      try {
        const u = new URL(imageUrlRaw);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
        imageUrl = u.toString();
      } catch {
        return { error: 'Image URL must be a valid http(s) link.' };
      }
    }

    await createAward(admin.discordId, { name, icon, imageUrl, description });
    revalidatePath('/admin/awards');
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function deleteAwardAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const awardId = str(formData, 'awardId');
    if (!awardId) return { error: 'Missing award.' };

    await deleteAward(admin.discordId, awardId);
    revalidatePath('/admin/awards');
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function grantAwardAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const awardId = str(formData, 'awardId');
  try {
    const admin = await requireAdminAction();
    if (!awardId) return { error: 'Missing award.' };

    const publicId = str(formData, 'publicId');
    if (!publicId) return { error: 'Pick a player.' };

    const tournamentId = str(formData, 'tournamentId') || null;
    const seasonRaw = str(formData, 'season');
    const season = seasonRaw ? parseInt(seasonRaw, 10) : null;
    if (season !== null && (!Number.isInteger(season) || season < 1)) {
      return { error: 'Season must be a positive number.' };
    }

    const granted = await grantAward(admin.discordId, { awardId, publicId, tournamentId, season });
    await announceAward({
      awardName: granted.awardName,
      icon: granted.awardIcon,
      playerName: granted.playerName,
      publicId,
      season,
    });
    // Submitted from the awards hub, an award's page or a player's admin page —
    // refresh every surface that shows holders.
    const playerPublicId = str(formData, 'playerPublicId');
    if (playerPublicId) revalidatePath(`/admin/players/${playerPublicId}`);
    else revalidatePath(`/admin/awards/${awardId}`);
    revalidatePath('/admin/awards');
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function revokeAwardAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const awardId = str(formData, 'awardId');
  try {
    const admin = await requireAdminAction();

    const userAwardId = str(formData, 'userAwardId');
    if (!userAwardId) return { error: 'Missing grant.' };

    await revokeAward(admin.discordId, userAwardId);
    const playerPublicId = str(formData, 'playerPublicId');
    if (playerPublicId) revalidatePath(`/admin/players/${playerPublicId}`);
    else revalidatePath(`/admin/awards/${awardId}`);
    revalidatePath('/admin/awards');
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function updatePlayerProfileAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const publicId = str(formData, 'publicId');
    if (!publicId) return { error: 'Missing player.' };

    const title = str(formData, 'title').slice(0, 40) || null;
    const characterNote = str(formData, 'characterNote').slice(0, 600) || null;
    const achievements = str(formData, 'achievements').slice(0, 1000) || null;

    const accentRaw = str(formData, 'accentColor');
    let accentColor: string | null = null;
    if (accentRaw) {
      if (!/^#[0-9a-f]{6}$/i.test(accentRaw)) {
        return { error: 'Accent colour must be a hex code like #ff7a1a.' };
      }
      accentColor = accentRaw.toLowerCase();
    }

    await updatePlayerProfileByAdmin(admin.discordId, publicId, {
      title,
      characterNote,
      achievements,
      showCharacter: formData.get('showCharacter') === 'on',
      showAchievements: formData.get('showAchievements') === 'on',
      showAwards: formData.get('showAwards') === 'on',
      accentColor,
    });

    revalidatePath(`/admin/players/${publicId}`);
    revalidatePath(`/p/${publicId}`);
    return { ok: true, message: 'Profile saved.' };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function recalcRanksAction(
  _prev: AdminFormState,
  _formData: FormData,
): Promise<AdminFormState> {
  try {
    await requireAdminAction();
    await recomputeRanks();
    revalidatePath('/');
    revalidatePath('/admin/players');
    return { ok: true, message: 'Ranks recalculated — equal Elo shares the same rank.' };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function updateConfigAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const num = (key: string) => parseFloat(str(formData, key));
    const currentSeason = parseInt(str(formData, 'currentSeason'), 10);
    const eloBase = num('eloBase');
    const kPlacement = parseInt(str(formData, 'kPlacement'), 10);
    const kEstablished = parseInt(str(formData, 'kEstablished'), 10);
    const placementGames = parseInt(str(formData, 'placementGames'), 10);
    const movMultiplierCap = num('movMultiplierCap');

    if (!Number.isInteger(currentSeason) || currentSeason < 1) return { error: 'Season must be a positive number.' };
    if (!Number.isFinite(eloBase) || eloBase <= 0) return { error: 'Elo base must be a positive number.' };
    if (!Number.isInteger(kPlacement) || kPlacement <= 0) return { error: 'Placement K-factor must be a positive number.' };
    if (!Number.isInteger(kEstablished) || kEstablished <= 0) return { error: 'Established K-factor must be a positive number.' };
    if (!Number.isInteger(placementGames) || placementGames < 1) return { error: 'Placement games must be at least 1.' };
    if (!Number.isFinite(movMultiplierCap) || movMultiplierCap < 1) return { error: 'Margin cap must be at least 1.' };

    const guildId = str(formData, 'guildId') || null;
    const rankingsMessageId = str(formData, 'rankingsMessageId') || null;

    // CASUAL: which EA club(s) the bot polls, and on which cross-play pool.
    const eaClubIdsRaw = str(formData, 'eaClubIds');
    if (eaClubIdsRaw && !/^\d+(\s*,\s*\d+)*$/.test(eaClubIdsRaw)) {
      return { error: 'EA Club IDs must be numbers, comma-separated.' };
    }
    const eaClubIds = eaClubIdsRaw
      ? eaClubIdsRaw.split(',').map(s => s.trim()).filter(Boolean).join(',')
      : null;
    const eaPlatform = str(formData, 'eaPlatform').toLowerCase() || 'common-gen5';
    if (!/^[a-z0-9-]{2,20}$/.test(eaPlatform)) {
      return { error: 'EA platform looks wrong — e.g. common-gen5.' };
    }

    await updateConfig(admin.discordId, {
      currentSeason, eloBase, kPlacement, kEstablished, placementGames, movMultiplierCap,
      guildId, rankingsMessageId, eaClubIds, eaPlatform,
    });

    revalidatePath('/admin/settings');
    return { ok: true, message: 'Settings saved.' };
  } catch (e) {
    return { error: message(e) };
  }
}

// ── Draft board ────────────────────────────────────────────────────────────────

export async function addTeamMemberAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const teamId = str(formData, 'teamId');
    const publicId = str(formData, 'publicId');
    const tournamentId = str(formData, 'tournamentId');
    if (!teamId || !publicId) return { error: 'Missing team or player.' };

    await addTeamMember(admin.discordId, { teamId, publicId });
    revalidatePath(`/admin/tournaments/${tournamentId}/draft`);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function removeTeamMemberAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const teamId = str(formData, 'teamId');
    const publicId = str(formData, 'publicId');
    const tournamentId = str(formData, 'tournamentId');
    if (!teamId || !publicId) return { error: 'Missing team or player.' };

    await removeTeamMember(admin.discordId, { teamId, publicId });
    revalidatePath(`/admin/tournaments/${tournamentId}/draft`);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function setCaptainAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const teamId = str(formData, 'teamId');
    const publicId = str(formData, 'publicId') || null;
    const tournamentId = str(formData, 'tournamentId');
    if (!teamId) return { error: 'Missing team.' };

    await setTeamCaptain(admin.discordId, { teamId, publicId });
    revalidatePath(`/admin/tournaments/${tournamentId}/draft`);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

// ── Draft pool (fed on-demand by the bot's /checkvc, edited here) ────────────────

export async function addToDraftPoolAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    await requireAdminAction();
    const publicId = str(formData, 'publicId');
    const tournamentId = str(formData, 'tournamentId');
    if (!publicId) return { error: 'Missing player.' };

    await addToDraftPoolByPublicId(publicId);
    revalidatePath(`/admin/tournaments/${tournamentId}/draft`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function removeFromDraftPoolAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    await requireAdminAction();
    const publicId = str(formData, 'publicId');
    const tournamentId = str(formData, 'tournamentId');
    if (!publicId) return { error: 'Missing player.' };

    await removeFromDraftPool(publicId);
    revalidatePath(`/admin/tournaments/${tournamentId}/draft`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function clearDraftPoolAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    await requireAdminAction();
    const tournamentId = str(formData, 'tournamentId');

    await clearDraftPool();
    revalidatePath(`/admin/tournaments/${tournamentId}/draft`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

// ── Bracket ────────────────────────────────────────────────────────────────────

export async function generateBracketAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const tournamentId = str(formData, 'tournamentId');
    if (!tournamentId) return { error: 'Missing tournament.' };

    const created = await generateBracket(admin.discordId, tournamentId);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true, message: `Bracket drawn — ${created} fixture${created === 1 ? '' : 's'} created.` };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function generateGroupStageAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const tournamentId = str(formData, 'tournamentId');
    if (!tournamentId) return { error: 'Missing tournament.' };

    const created = await generateGroupStage(admin.discordId, tournamentId);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true, message: `Group stage drawn — ${created} fixture${created === 1 ? '' : 's'} created.` };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function generateKnockoutAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const tournamentId = str(formData, 'tournamentId');
    if (!tournamentId) return { error: 'Missing tournament.' };

    const created = await generateKnockoutFromTable(admin.discordId, tournamentId);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return {
      ok: true,
      message: created === 2
        ? 'Semi-finals drawn from the table (1st v 4th, 2nd v 3rd).'
        : 'Final drawn from the table (1st v 2nd).',
    };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function updateMatchStatsAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const matchId = str(formData, 'matchId');
    const tournamentId = str(formData, 'tournamentId');
    if (!matchId) return { error: 'Missing match.' };

    // One set of g_/a_/t_/cs_/m_ inputs per participant, keyed by publicId.
    const stats: { publicId: string; goals: number; assists: number; cleanSheet: boolean; tackles: number; mom: boolean }[] = [];
    for (const key of Array.from(formData.keys())) {
      if (!key.startsWith('g_')) continue;
      const publicId = key.slice(2);
      const goals = parseInt(str(formData, `g_${publicId}`) || '0', 10);
      const assists = parseInt(str(formData, `a_${publicId}`) || '0', 10);
      const tackles = parseInt(str(formData, `t_${publicId}`) || '0', 10);
      if (!Number.isInteger(goals) || goals < 0 || !Number.isInteger(assists) || assists < 0 || !Number.isInteger(tackles) || tackles < 0) {
        return { error: 'Goals, assists and tackles must be whole numbers.' };
      }
      stats.push({
        publicId,
        goals,
        assists,
        tackles,
        cleanSheet: formData.get(`cs_${publicId}`) === 'on',
        mom: formData.get(`m_${publicId}`) === 'on',
      });
    }
    if (stats.length === 0) return { error: 'No players to save stats for.' };

    await updateMatchStats(admin.discordId, matchId, stats);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true, message: 'Stats saved.' };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function generateNextRoundAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const tournamentId = str(formData, 'tournamentId');
    if (!tournamentId) return { error: 'Missing tournament.' };

    const created = await generateNextRound(admin.discordId, tournamentId);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true, message: `Next round drawn — ${created} fixture${created === 1 ? '' : 's'} created.` };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function recordMatchResultAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const matchId = str(formData, 'matchId');
    const tournamentId = str(formData, 'tournamentId');
    if (!matchId) return { error: 'Missing match.' };

    const homeScore = parseInt(str(formData, 'homeScore'), 10);
    const awayScore = parseInt(str(formData, 'awayScore'), 10);
    if (!Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0) {
      return { error: 'Enter a valid scoreline.' };
    }

    const playedAtRaw = str(formData, 'playedAt');
    const playedAt = playedAtRaw ? new Date(playedAtRaw) : null;
    if (playedAt && Number.isNaN(playedAt.getTime())) return { error: 'Invalid played-at date.' };

    await recordMatchResult(admin.discordId, {
      matchId,
      homeScore,
      awayScore,
      playedAt,
      homePlayerPublicIds: formData.getAll('homePlayers').map(String),
      awayPlayerPublicIds: formData.getAll('awayPlayers').map(String),
    });

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

// ── Awards: edit ───────────────────────────────────────────────────────────────

export async function updateAwardAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const awardId = str(formData, 'awardId');
    if (!awardId) return { error: 'Missing award.' };

    const name = str(formData, 'name').slice(0, 60);
    if (!name) return { error: 'Name is required.' };
    const icon = str(formData, 'icon').slice(0, 8) || null;
    const description = str(formData, 'description').slice(0, 200) || null;

    const imageUrlRaw = str(formData, 'imageUrl').slice(0, 500);
    let imageUrl: string | null = null;
    if (imageUrlRaw) {
      try {
        const u = new URL(imageUrlRaw);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
        imageUrl = u.toString();
      } catch {
        return { error: 'Image URL must be a valid http(s) link.' };
      }
    }

    await updateAward(admin.discordId, awardId, { name, icon, imageUrl, description });
    revalidatePath(`/admin/awards/${awardId}`);
    revalidatePath('/admin/awards');
    return { ok: true, message: 'Award saved.' };
  } catch (e) {
    return { error: message(e) };
  }
}

// ── Player identity (admin edit of a player's own fields) ─────────────────────

export async function updatePlayerIdentityAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const publicId = str(formData, 'publicId');
    if (!publicId) return { error: 'Missing player.' };

    const displayName = str(formData, 'displayName').slice(0, 32);
    if (!displayName) return { error: 'Display name is required.' };

    const country = str(formData, 'country').toUpperCase().slice(0, 8) || null;
    if (country && !/^[A-Z]{2}(-[A-Z]{2,3})?$/.test(country)) return { error: 'Invalid country.' };

    await updatePlayerIdentityByAdmin(admin.discordId, publicId, {
      displayName,
      position1: str(formData, 'position1') || null,
      position2: str(formData, 'position2') || null,
      country,
      quote: str(formData, 'quote').slice(0, 100) || null,
      bio: str(formData, 'bio').slice(0, 300) || null,
    });

    revalidatePath(`/admin/players/${publicId}`);
    revalidatePath(`/p/${publicId}`);
    return { ok: true, message: 'Player profile saved.' };
  } catch (e) {
    return { error: message(e) };
  }
}
