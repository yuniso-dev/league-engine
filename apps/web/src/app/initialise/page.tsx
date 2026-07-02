import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserByDiscordId } from '@inazuma/db';
import InitialiseForm from '@/components/InitialiseForm';
import { initialise } from './actions';

export const dynamic = 'force-dynamic';

export default async function InitialisePage() {
  const session = await auth();
  if (!session?.user?.discordId) redirect('/signin?next=%2Finitialise');

  const user = await getUserByDiscordId(session.user.discordId);
  if (user?.initialised) redirect('/settings');

  return (
    <InitialiseForm
      action={initialise}
      defaultDisplayName={user?.displayName ?? session.user.name ?? ''}
    />
  );
}
