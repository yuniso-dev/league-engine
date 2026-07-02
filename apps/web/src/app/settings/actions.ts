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
  const bio   = ((formData.get('bio')   as string) || '').trim().slice(0, 300) || null;

  // Invalid hex is silently dropped (keeps the previous value); empty clears it.
  const accentRaw = ((formData.get('accentColor') as string) || '').trim();
  const accentColor = accentRaw === ''
    ? null
    : /^#[0-9a-f]{6}$/i.test(accentRaw) ? accentRaw.toLowerCase() : undefined;

  await updateSettings(session.user.discordId, {
    displayName,
    position1,
    position2,
    hidePositions,
    country,
    quote,
    bio,
    accentColor,
  });

  revalidatePath('/settings');
}
