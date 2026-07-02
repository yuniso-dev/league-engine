'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { initialiseUser } from '@inazuma/db';

export async function initialise(formData: FormData) {
  const session = await auth();
  if (!session?.user?.discordId) redirect('/api/auth/signin');

  const displayName = (formData.get('displayName') as string ?? '').trim().slice(0, 32);
  if (!displayName) return;

  const position1 = (formData.get('position1') as string) || null;
  const position2 = (formData.get('position2') as string) || null;
  const hidePositions = formData.get('hidePositions') === 'on';
  const country = ((formData.get('country') as string) || '').toUpperCase().slice(0, 2) || null;

  const publicId = await initialiseUser(session.user.discordId, {
    displayName,
    position1,
    position2,
    hidePositions,
    country,
  });
  redirect(`/p/${publicId}`);
}
