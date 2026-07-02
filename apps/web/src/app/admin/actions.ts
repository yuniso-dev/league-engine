'use server';

import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import {
  MATCH_STAGES,
  commitReveal,
  createAward,
  createMatch,
  createTeam,
  createTournament,
  deleteAward,
  deleteMatch,
  deleteTeam,
  deleteTournament,
  grantAward,
  revokeAward,
  updateConfig,
  updatePlayerProfileByAdmin,
  updateTournament,
  updateTournamentStatus,
  type MatchStage,
} from '@inazuma/db';
import { requireAdminAction } from '@/lib/admin';

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
    revalidateTag('tournaments');
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
    revalidateTag('tournaments');
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
    revalidateTag('tournaments');
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

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    revalidatePath('/admin');
    revalidateTag('tournaments');
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
    revalidateTag('rankings');
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

    await grantAward(admin.discordId, { awardId, publicId, tournamentId, season });
    // Submitted either from the award's page or a player's admin page —
    // refresh whichever surface the form lives on.
    const playerPublicId = str(formData, 'playerPublicId');
    if (playerPublicId) revalidatePath(`/admin/players/${playerPublicId}`);
    else revalidatePath(`/admin/awards/${awardId}`);
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
    revalidateTag('rankings'); // title/accent flow into the public player payload
    return { ok: true, message: 'Profile saved.' };
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

    await updateConfig(admin.discordId, {
      currentSeason, eloBase, kPlacement, kEstablished, placementGames, movMultiplierCap,
      guildId, rankingsMessageId,
    });

    revalidatePath('/admin/settings');
    return { ok: true, message: 'Settings saved.' };
  } catch (e) {
    return { error: message(e) };
  }
}
