'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { updateSettings } from '@inazuma/db';

export async function saveSettings(formData: FormData) {
  const session = await auth();
  if (!session?.user?.discordId) return;

  const displayName = (formData.get('displayName') as string ?? '').trim().slice(0, 32);
  if (!displayName) return;

  const position1 = (formData.get('position1') as string) || null;
  const position2 = (formData.get('position2') as string) || null;
  const hidePositions = formData.get('hidePositions') === 'on';
  const country = ((formData.get('country') as string) || '').toUpperCase().slice(0, 2) || null;
  const quote = ((formData.get('quote') as string) || '').trim().slice(0, 100) || null;
  const bio = ((formData.get('bio') as string) || '').trim().slice(0, 300) || null;

  await updateSettings(session.user.discordId, {
    displayName,
    position1,
    position2,
    hidePositions,
    country,
    quote,
    bio,
  });

  revalidatePath('/settings');
}
