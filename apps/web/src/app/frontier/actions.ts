'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { runResilient, signUpForTournament, withdrawSignup } from '@inazuma/db';
import { getCachedUserByDiscordId } from '@/lib/user';

export type SignupFormState = { error?: string; ok?: boolean };

function message(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.';
}

export async function signUpAction(
  _prev: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const tournamentId = ((formData.get('tournamentId') as string) ?? '').trim();
  if (!tournamentId) return { error: 'Missing tournament.' };

  const session = await auth();
  if (!session?.user?.discordId) return { error: 'Sign in with Discord first.' };

  const user = await getCachedUserByDiscordId(session.user.discordId);
  if (!user || user.isBlacklisted) return { error: 'Account not recognised.' };
  if (!user.initialised) return { error: 'Complete your profile first — tap your avatar → Settings.' };

  try {
    await runResilient(() => signUpForTournament(user.discordId, tournamentId));
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/frontier/${tournamentId}`);
  revalidatePath('/');
  return { ok: true };
}

export async function withdrawAction(
  _prev: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const tournamentId = ((formData.get('tournamentId') as string) ?? '').trim();
  if (!tournamentId) return { error: 'Missing tournament.' };

  const session = await auth();
  if (!session?.user?.discordId) return { error: 'Sign in with Discord first.' };

  try {
    await runResilient(() => withdrawSignup(session.user.discordId, tournamentId));
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/frontier/${tournamentId}`);
  revalidatePath('/');
  return { ok: true };
}
