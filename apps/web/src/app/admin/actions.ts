'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { revalidatePublicData } from '@/lib/cache';
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
  findAwardByName,
  generateBracket,
  generateFrontierFixtures,
  generateGroupStage,
  generateKnockoutFromTable,
  generateNextRound,
  getCeremonySheet,
  getTournamentById,
  getTournamentDetail,
  grantAward,
  grantAwardIfAbsent,
  recomputeRanks,
  resetSeasonRatings,
  setPlayerElo,
  importLegacy,
  applyPendingMatch,
  discardPendingMatch,
  removeTournamentExclusion,
  setTournamentExclusion,
  issueSanction,
  liftSanction,
  getLatestOpenTournament,
  addTrackedClubs,
  removeTrackedClub,
  voidMatchResult,
  type SanctionType,
  recordMatchResult,
  removeFromDraftPool,
  updateMatchStats,
  removeTeamMember,
  revokeAward,
  setTeamCaptain,
  setTeamEaClub,
  updateAward,
  updateConfig,
  updatePlayerIdentityByAdmin,
  updatePlayerProfileByAdmin,
  updateTournament,
  updateTournamentStatus,
  type MatchStage,
} from '@inazuma/db';
import { HONOURS, isRomanNumeral, parseLegacyArchive } from '@inazuma/core';
import { pickTeamOfTournament } from '@/lib/tott';
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

/** The tournament form sends kickoff as a browser-resolved ISO instant (or ''
 *  when blank). Returns the Date, null when unset, or 'invalid' on garbage. */
function parseStartTime(raw: string): Date | null | 'invalid' {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 'invalid' : d;
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
    // Season 0 is allowed — it's the "Beta" label for the test frontier.
    if (!Number.isInteger(season) || season < 0) return { error: 'Season must be 0 or greater.' };

    const startTime = parseStartTime(str(formData, 'startTime'));
    if (startTime === 'invalid') return { error: 'Kickoff time looks wrong — pick it again.' };

    id = await createTournament(admin.discordId, {
      name,
      season,
      ranked: formData.get('ranked') === 'on',
      date: startTime ? startTime.toISOString().slice(0, 10) : null,
      startTime,
    });
    // New Frontier opens as 'upcoming' with signups live — announce it.
    await announceSignupsOpen({ id, name, season });
    revalidatePublicData(); // show the new Frontier on the public site at once
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
    // Season 0 is allowed — it's the "Beta" label for the test frontier.
    if (!Number.isInteger(season) || season < 0) return { error: 'Season must be 0 or greater.' };

    const startTime = parseStartTime(str(formData, 'startTime'));
    if (startTime === 'invalid') return { error: 'Kickoff time looks wrong — pick it again.' };

    await updateTournament(admin.discordId, tournamentId, {
      name,
      season,
      ranked: formData.get('ranked') === 'on',
      date: startTime ? startTime.toISOString().slice(0, 10) : null,
      startTime,
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
    revalidatePublicData(); // status change (live/completed + champion) shows now
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

    const eaClubIdRaw = str(formData, 'eaClubId');
    if (eaClubIdRaw && !/^\d{1,12}$/.test(eaClubIdRaw)) {
      return { error: 'EA Club ID must be a number — find it with /findclub in Discord.' };
    }

    const memberPublicIds = formData.getAll('members').map(String);
    await createTeam(admin.discordId, { tournamentId, name, memberPublicIds, eaClubId: eaClubIdRaw || null });

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function setTeamClubAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const teamId = str(formData, 'teamId');
    const tournamentId = str(formData, 'tournamentId');
    if (!teamId) return { error: 'Missing team.' };

    const eaClubIdRaw = str(formData, 'eaClubId');
    if (eaClubIdRaw && !/^\d{1,12}$/.test(eaClubIdRaw)) {
      return { error: 'EA Club ID must be a number — find it with /findclub in Discord.' };
    }

    await setTeamEaClub(admin.discordId, teamId, eaClubIdRaw || null);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true, message: eaClubIdRaw ? `✓ Linked club ${eaClubIdRaw}` : '✓ Club cleared' };
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
    // Award-only reveals (players moved, no matches) are valid commits.
    if (matches === 0 && players === 0) {
      return { error: 'Nothing to process — no pending ranked matches or award bonuses.' };
    }

    revalidatePath('/admin/reveal');
    revalidatePath('/');
    revalidatePublicData(); // new ratings/ranks live on the public ladder now
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

/** The ceremony's GRANT ALL: find-or-create each per-edition honour
 *  ("Blaze's Boot XVII") and grant it to every computed/picked winner.
 *  Winners are recomputed SERVER-SIDE — the client only supplies the numeral
 *  and the two voted picks. Safe to re-run: existing holders are skipped. */
export async function runCeremonyAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const tournamentId = str(formData, 'tournamentId');
    if (!tournamentId) return { error: 'Missing tournament.' };

    const numeral = str(formData, 'numeral').toUpperCase();
    if (!isRomanNumeral(numeral)) return { error: 'Edition must be a valid roman numeral (e.g. XVII).' };

    // Never trust computed winners from the client — rebuild the sheet here.
    const sheet = await getCeremonySheet(tournamentId);
    if (!sheet) return { error: 'Tournament not found.' };

    // Xavier Frost is the only voted honour left; its winner must be one of the
    // computed top-4 nominees (the same four the poll ran across).
    const pottPublicId = str(formData, 'pottPublicId');
    if (pottPublicId && !sheet.pottNominees.some(p => p.publicId === pottPublicId)) {
      return { error: 'Xavier Frost pick must be one of the top-4 rated players.' };
    }

    // Mr Inazuma: the admin picks the champion's captain from the winning
    // roster (defaults to the team's set captain, but a team may not have one).
    const mrInazumaPublicId = str(formData, 'mrInazumaPublicId');
    const championMembers = sheet.championTeam?.members ?? [];
    if (mrInazumaPublicId && !championMembers.some(m => m.publicId === mrInazumaPublicId)) {
      return { error: 'Mr Inazuma must be a member of the winning team.' };
    }
    const mrInazuma = mrInazumaPublicId
      ? championMembers.filter(m => m.publicId === mrInazumaPublicId)
      : sheet.championTeam?.captain ? [sheet.championTeam.captain] : [];

    // Team of the Tournament — the same best-XI the page shows — now grants an
    // award to each named player (recomputed server-side, never trusted from the client).
    const tottPlayers = pickTeamOfTournament(sheet.ratedPlayers).flatMap(line => line.players);

    // Winners per honour key; empty honours are skipped, ties grant to all.
    // Wallside's Award and the Golden Glove are now fully computed (min 3 games).
    const glove = sheet.gkTable[0] ?? null;
    const winners: Record<string, { publicId: string; displayName: string }[]> = {
      topScorer: sheet.topScorers,
      topAssister: sheet.topAssisters,
      goldenGlove: glove ? [glove] : [],
      bestDefender: sheet.bestDefenders,
      pott: pottPublicId
        ? sheet.pottNominees.filter(p => p.publicId === pottPublicId) : [],
      champion: championMembers,
      mrInazuma,
      tott: tottPlayers,
    };

    const season = sheet.tournament.season;
    let granted = 0;
    let skipped = 0;
    for (const h of HONOURS) {
      const list = winners[h.key];
      if (!list || list.length === 0) continue;

      const name = `${h.base} ${numeral}`;
      const awardId = (await findAwardByName(name))?.id
        ?? await createAward(admin.discordId, { name, icon: h.icon, imageUrl: null, description: h.description });

      for (const winner of list) {
        const result = await grantAwardIfAbsent(admin.discordId, {
          awardId, publicId: winner.publicId, tournamentId, season,
        });
        if (!result) { skipped++; continue; }
        granted++;
        // Webhook the individual honours; the champion team's and Team of the
        // Tournament's 5-7 grants would be embed spam — the copy-box
        // announcement covers those group moments.
        if (h.key !== 'champion' && h.key !== 'tott') {
          await announceAward({
            awardName: result.awardName,
            icon: result.awardIcon,
            playerName: result.playerName,
            publicId: winner.publicId,
            season,
          });
        }
      }
    }

    if (granted === 0 && skipped === 0) return { error: 'Nothing to grant yet — record results or pick winners first.' };

    revalidatePath(`/admin/tournaments/${tournamentId}/awards`);
    revalidatePath('/admin/awards');
    revalidatePath('/hall-of-fame');
    revalidatePublicData(); // new honours on the ladder + hall of fame at once
    return {
      ok: true,
      message: `Granted ${granted} honour${granted === 1 ? '' : 's'}${skipped > 0 ? ` (${skipped} already held — skipped)` : ''}.`,
    };
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
    revalidatePublicData(); // refreshed ladder live on the public site
    return {
      ok: true,
      message: 'Ladder normalised — participation floor applied, never-played unranked, ties share a rank.',
    };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function resetSeasonAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    // Type-to-confirm guard — this wipes the whole ladder.
    if (str(formData, 'confirm').toUpperCase() !== 'RESET') {
      return { error: 'Type RESET to confirm — this clears every player\'s Elo, games and ranks.' };
    }
    const newSeason = parseInt(str(formData, 'newSeason'), 10);
    if (!Number.isInteger(newSeason) || newSeason < 1) return { error: 'New season must be 1 or greater.' };

    const { players } = await resetSeasonRatings(admin.discordId, { newSeason });

    revalidatePath('/');
    revalidatePath('/admin/players');
    revalidatePath('/admin/settings');
    revalidatePublicData();
    return {
      ok: true,
      message: `Season reset — ${players} player${players === 1 ? '' : 's'} back to base Elo, ladder cleared, now Season ${newSeason}.`,
    };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function setPlayerEloAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const publicId = str(formData, 'publicId');
    if (!publicId) return { error: 'Missing player.' };

    const elo = parseFloat(str(formData, 'elo'));
    if (!Number.isFinite(elo) || elo < 0 || elo > 9999) return { error: 'Elo must be between 0 and 9999.' };

    const gamesRaw = str(formData, 'gamesPlayed');
    let gamesPlayed: number | undefined;
    if (gamesRaw) {
      const g = parseInt(gamesRaw, 10);
      if (!Number.isInteger(g) || g < 0) return { error: 'Games played must be 0 or greater.' };
      gamesPlayed = g;
    }

    await setPlayerElo(admin.discordId, publicId, { elo, gamesPlayed });

    revalidatePath(`/admin/players/${publicId}`);
    revalidatePath(`/p/${publicId}`);
    revalidatePublicData();
    return { ok: true, message: `Elo set to ${Math.round(elo)}. Ranks refresh on the next reveal or recalc.` };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function importLegacyAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const text = str(formData, 'archive');
    if (!text) return { error: 'Paste the awards history first.' };

    const editions = parseLegacyArchive(text);
    if (editions.length === 0) {
      return { error: 'No Frontier editions found — check the format (a "## Frontier IX" heading, then lines like "🏆 Winners: <@id> …").' };
    }

    const { editions: e, winners } = await importLegacy(admin.discordId, editions);

    revalidatePath('/hall-of-fame');
    revalidatePath('/admin/legacy');
    revalidatePublicData();
    return {
      ok: true,
      message: `Imported ${e} edition${e === 1 ? '' : 's'} and ${winners} honour${winners === 1 ? '' : 's'}. It's live on the Hall of Fame → Legacy.`,
    };
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

    // FRONTIER: the standing rules block /frontierintro pastes into its draft.
    const frontierRules = str(formData, 'frontierRules').slice(0, 4000) || null;

    // Discord roles the bot mirrors (signed-up roster / active suspensions / legacy / beta).
    const signupRoleId = str(formData, 'signupRoleId') || null;
    const punishedRoleId = str(formData, 'punishedRoleId') || null;
    const legacyRoleId = str(formData, 'legacyRoleId') || null;
    const betaRoleId = str(formData, 'betaRoleId') || null;
    for (const [label, id] of [['Signed-up', signupRoleId], ['Punished', punishedRoleId], ['Legacy', legacyRoleId], ['Beta', betaRoleId]] as const) {
      if (id && !/^\d{5,25}$/.test(id)) {
        return { error: `${label} role ID must be a numeric Discord role ID (right-click the role → Copy Role ID).` };
      }
    }

    await updateConfig(admin.discordId, {
      currentSeason, eloBase, kPlacement, kEstablished, placementGames, movMultiplierCap,
      guildId, rankingsMessageId, eaClubIds, eaPlatform, frontierRules, signupRoleId, punishedRoleId,
      legacyRoleId, betaRoleId,
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

/** Auto-format generator: picks the format from the team count and creates the
 *  group/series fixtures. The knockout is drawn automatically once the group
 *  finishes (by the bot) or via the button below. */
export async function generateFrontierFixturesAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const tournamentId = str(formData, 'tournamentId');
    if (!tournamentId) return { error: 'Missing tournament.' };

    const { created, label } = await generateFrontierFixtures(admin.discordId, tournamentId);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true, message: `${label} — ${created} fixture${created === 1 ? '' : 's'} created.` };
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

/** VOID a bad auto-recorded result (back-out at kickoff, half-time glitch):
 *  fixture reopens, junk EA match is blacklisted, the real replay auto-records. */
export async function voidMatchAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const matchId = str(formData, 'matchId');
    const tournamentId = str(formData, 'tournamentId');
    if (!matchId) return { error: 'Missing match.' };

    await voidMatchResult(admin.discordId, matchId, str(formData, 'reason') || null);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true, message: 'Result voided — the fixture is open again and the real game will auto-record.' };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function excludePlayerAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const tournamentId = str(formData, 'tournamentId');
    const publicId = str(formData, 'publicId');
    if (!tournamentId || !publicId) return { error: 'Pick a player.' };

    await setTournamentExclusion(admin.discordId, {
      tournamentId,
      publicId,
      reason: str(formData, 'reason').slice(0, 200) || null,
    });
    revalidatePath(`/admin/tournaments/${tournamentId}/awards`);
    revalidatePath(`/frontier/${tournamentId}`);
    return { ok: true, message: 'Excluded from this Frontier’s honours.' };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function removeExclusionAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const tournamentId = str(formData, 'tournamentId');
    const publicId = str(formData, 'publicId');
    if (!tournamentId || !publicId) return { error: 'Missing player.' };

    await removeTournamentExclusion(admin.discordId, { tournamentId, publicId });
    revalidatePath(`/admin/tournaments/${tournamentId}/awards`);
    revalidatePath(`/frontier/${tournamentId}`);
    return { ok: true, message: 'Exclusion lifted.' };
  } catch (e) {
    return { error: message(e) };
  }
}

/** Register EA clubs on the tracker — IDs only (the site can't reach EA;
 *  the bot fills names + stats within minutes; /trackclub adds by name). */
export async function addTrackedClubsAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const raw = str(formData, 'clubIds');
    if (!raw) return { error: 'Paste at least one EA club ID.' };

    const ids = raw.split(/[\s,]+/).filter(Boolean);
    const bad = ids.filter(id => !/^\d{1,12}$/.test(id));
    if (bad.length > 0) {
      return { error: `Not numeric club IDs: ${bad.slice(0, 5).join(', ')}. Find IDs with /findclub or /trackclub in Discord.` };
    }

    const added = await addTrackedClubs(admin.discordId, ids);
    revalidatePath('/admin/clubs');
    return {
      ok: true,
      message: added === 0
        ? 'All of those were already tracked.'
        : `Tracking ${added} new club${added === 1 ? '' : 's'} — the bot fills in names and stats within a few minutes.`,
    };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function removeTrackedClubAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const clubId = str(formData, 'clubId');
    if (!clubId) return { error: 'Missing club.' };

    await removeTrackedClub(admin.discordId, clubId);
    revalidatePath('/admin/clubs');
    return { ok: true, message: 'Club removed from the tracker.' };
  } catch (e) {
    return { error: message(e) };
  }
}

/** Suspend a player (no-show / abandoned mid-tournament / other). */
export async function issueSanctionAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const publicId = str(formData, 'publicId');
    if (!publicId) return { error: 'Missing player.' };

    const type = str(formData, 'type');
    if (type !== 'no_show' && type !== 'abandon' && type !== 'other') return { error: 'Pick a sanction type.' };

    const frontiersRaw = str(formData, 'frontiers');
    const frontiers = frontiersRaw ? parseInt(frontiersRaw, 10) : undefined;
    if (frontiers !== undefined && (!Number.isInteger(frontiers) || frontiers < 1 || frontiers > 10)) {
      return { error: 'Frontiers must be 1–10 (leave blank for the default).' };
    }

    // The open Frontier is the offence context — its completion never serves
    // the ban, so "sits out the NEXT one" means exactly that.
    const open = await getLatestOpenTournament();

    const sanction = await issueSanction(admin.discordId, {
      publicId,
      type: type as SanctionType,
      reason: str(formData, 'reason').slice(0, 300) || null,
      frontiers,
      tournamentId: open?.id ?? null,
    });
    revalidatePath(`/admin/players/${publicId}`);
    const n = sanction.frontiersRemaining;
    return { ok: true, message: `Suspended for ${n} Frontier${n === 1 ? '' : 's'} — role + DM follow within a minute.` };
  } catch (e) {
    return { error: message(e) };
  }
}

/** Lift one suspension early. */
export async function liftSanctionAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const sanctionId = str(formData, 'sanctionId');
    const publicId = str(formData, 'playerPublicId');
    if (!sanctionId) return { error: 'Missing sanction.' };

    await liftSanction(admin.discordId, sanctionId);
    if (publicId) revalidatePath(`/admin/players/${publicId}`);
    return { ok: true, message: 'Suspension lifted.' };
  } catch (e) {
    return { error: message(e) };
  }
}

/** APPLY a captured game onto its fixture (voiding the game it replaces). */
export async function applyPendingAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const eaMatchId = str(formData, 'eaMatchId');
    const tournamentId = str(formData, 'tournamentId');
    if (!eaMatchId) return { error: 'Missing captured game.' };

    const message_ = await applyPendingMatch(admin.discordId, eaMatchId);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true, message: message_ };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function discardPendingAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();
    const eaMatchId = str(formData, 'eaMatchId');
    const tournamentId = str(formData, 'tournamentId');
    if (!eaMatchId) return { error: 'Missing captured game.' };

    await discardPendingMatch(admin.discordId, eaMatchId);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { ok: true, message: 'Discarded.' };
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

    // One set of g_/a_/t_/cs_/m_/r_/s_/p_/rc_ inputs per participant, keyed by publicId.
    const POSITIONS = ['goalkeeper', 'defender', 'midfielder', 'forward'];
    const stats: {
      publicId: string; goals: number; assists: number; cleanSheet: boolean; tackles: number;
      mom: boolean; rating: number | null; saves: number; position: string | null; redCards: number;
    }[] = [];
    for (const key of Array.from(formData.keys())) {
      if (!key.startsWith('g_')) continue;
      const publicId = key.slice(2);
      const goals = parseInt(str(formData, `g_${publicId}`) || '0', 10);
      const assists = parseInt(str(formData, `a_${publicId}`) || '0', 10);
      const tackles = parseInt(str(formData, `t_${publicId}`) || '0', 10);
      const saves = parseInt(str(formData, `s_${publicId}`) || '0', 10);
      if ([goals, assists, tackles, saves].some(n => !Number.isInteger(n) || n < 0)) {
        return { error: 'Goals, assists, tackles and saves must be whole numbers.' };
      }
      const ratingRaw = str(formData, `r_${publicId}`);
      const rating = ratingRaw === '' ? null : parseFloat(ratingRaw);
      if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 10)) {
        return { error: 'Rating must be between 0 and 10, or blank.' };
      }
      const positionRaw = str(formData, `p_${publicId}`);
      const position = POSITIONS.includes(positionRaw) ? positionRaw : null;
      stats.push({
        publicId,
        goals,
        assists,
        tackles,
        cleanSheet: formData.get(`cs_${publicId}`) === 'on',
        mom: formData.get(`m_${publicId}`) === 'on',
        rating,
        saves,
        position,
        redCards: formData.get(`rc_${publicId}`) === 'on' ? 1 : 0,
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
    });

    revalidatePath(`/admin/players/${publicId}`);
    revalidatePath(`/p/${publicId}`);
    return { ok: true, message: 'Player profile saved.' };
  } catch (e) {
    return { error: message(e) };
  }
}
