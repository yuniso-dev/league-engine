'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  MATCH_STAGES,
  createMatch,
  createTeam,
  createTournament,
  deleteMatch,
  deleteTeam,
  updateTournamentStatus,
  type MatchStage,
} from '@inazuma/db';
import { requireAdminAction } from '@/lib/admin';

// All admin forms use useFormState so validation problems surface inline.
export type AdminFormState = { error?: string; ok?: boolean };

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
      startDate: str(formData, 'startDate') || null,
      endDate: str(formData, 'endDate') || null,
    });
  } catch (e) {
    return { error: message(e) };
  }
  redirect(`/admin/tournaments/${id}`);
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
