'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { runResilient, updateOwnProfileFields, updateSettings } from '@inazuma/db';
import { isValidCountryCode } from '@/lib/countries';

/** Inline (pen-icon) edits on a player's own profile — quote and accent only.
 *  Returns an error string, or null on success. */
export async function saveOwnFlair(data: {
  quote?: string;
  accentColor?: string;
}): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.discordId) return 'Not signed in.';

  const fields: { quote?: string | null; accentColor?: string | null } = {};

  if (data.quote !== undefined) {
    fields.quote = data.quote.trim().slice(0, 100) || null;
  }
  if (data.accentColor !== undefined) {
    const raw = data.accentColor.trim();
    if (raw === '') fields.accentColor = null;
    else if (/^#[0-9a-f]{6}$/i.test(raw)) fields.accentColor = raw.toLowerCase();
    else return 'Invalid colour.';
  }

  try {
    // Timeout + rebuild-pool-and-retry-once: a save can't be stranded by a
    // wedged connection pool (quote, accent and bio all come through here
    // or saveSettings — same protection for both).
    await runResilient(() => updateOwnProfileFields(session.user.discordId!, fields));
  } catch (e) {
    console.error('[saveOwnFlair] failed after retry:', e instanceof Error ? e.message : e);
    return 'The database is not responding — nothing was saved. Try again in a few seconds.';
  }
  revalidatePath('/');
  revalidatePath('/settings');
  return null;
}

export async function saveSettings(formData: FormData) {
  const session = await auth();
  if (!session?.user?.discordId) return;

  const displayName = (formData.get('displayName') as string ?? '').trim().slice(0, 32);
  if (!displayName) return;

  const position1 = (formData.get('position1') as string) || null;
  const position2 = (formData.get('position2') as string) || null;
  const hidePositions = formData.get('hidePositions') === 'on';
  // Accepts ISO codes and home-nation subdivisions (GB-ENG etc.).
  const countryRaw = ((formData.get('country') as string) || '').toUpperCase().slice(0, 8);
  const country = countryRaw && isValidCountryCode(countryRaw) ? countryRaw : null;
  const quote = ((formData.get('quote') as string) || '').trim().slice(0, 100) || null;
  const bio   = ((formData.get('bio')   as string) || '').trim().slice(0, 300) || null;

  // Invalid hex is silently dropped (keeps the previous value); empty clears it.
  const accentRaw = ((formData.get('accentColor') as string) || '').trim();
  const accentColor = accentRaw === ''
    ? null
    : /^#[0-9a-f]{6}$/i.test(accentRaw) ? accentRaw.toLowerCase() : undefined;

  await runResilient(() =>
    updateSettings(session.user.discordId!, {
      displayName,
      position1,
      position2,
      hidePositions,
      country,
      quote,
      bio,
      accentColor,
    }),
  );

  revalidatePath('/settings');
}
