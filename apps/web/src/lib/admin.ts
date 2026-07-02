import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { type UserRow } from '@inazuma/db';
import { getCachedUserByDiscordId } from '@/lib/user';

function isStaff(user: UserRow | null): user is UserRow {
  return user !== null && (user.role === 'owner' || user.role === 'admin');
}

/**
 * Page guard for /admin routes. Redirects signed-out visitors to sign-in;
 * renders 404 for signed-in non-staff so the back-office stays invisible.
 */
export async function requireAdmin(): Promise<UserRow> {
  const session = await auth();
  if (!session?.user?.discordId) redirect('/signin?next=%2Fadmin');
  const user = await getCachedUserByDiscordId(session.user.discordId);
  if (!isStaff(user)) notFound();
  return user;
}

/**
 * Server-action guard. Every admin mutation must call this — pages gate
 * rendering, but actions are directly invokable endpoints.
 */
export async function requireAdminAction(): Promise<UserRow> {
  const session = await auth();
  if (!session?.user?.discordId) throw new Error('Not signed in.');
  const user = await getCachedUserByDiscordId(session.user.discordId);
  if (!isStaff(user)) throw new Error('Not authorised.');
  return user;
}
