import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserByDiscordId } from '@inazuma/db';
import SettingsForm from '@/components/SettingsForm';
import { saveSettings } from './actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.discordId) redirect('/signin?next=%2Fsettings');

  const user = await getUserByDiscordId(session.user.discordId);
  if (!user?.initialised) redirect('/initialise');

  return <SettingsForm action={saveSettings} user={user} />;
}
