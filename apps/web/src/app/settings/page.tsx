import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserByDiscordId, runResilient } from '@inazuma/db';
import SettingsForm from '@/components/SettingsForm';
import { saveSettings } from './actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.discordId) redirect('/signin?next=%2Fsettings');

  const user = await runResilient(() => getUserByDiscordId(session.user.discordId!));
  if (!user?.initialised) redirect('/initialise');

  return <SettingsForm action={saveSettings} user={user} />;
}
