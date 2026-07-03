// The bulletproof sign-in path: a plain GET navigation that starts the Discord
// OAuth flow SERVER-SIDE and answers with a 302 straight to the authorize
// screen. No client JavaScript, no fetch chain — works on every browser and
// device (iOS Chrome/Safari, Android, desktop). The /signin splash uses this
// as its guaranteed fallback; the client-side flow is only an upgrade that
// lets phones hand off to the native Discord app.
import { signIn } from '@/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('next') ?? '/';
  // Same-origin paths only — never redirect off-site after sign-in.
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
  // Throws NEXT_REDIRECT → Next answers with the 302 to Discord (state/PKCE
  // cookies are set on that same response).
  await signIn('discord', { redirectTo: next });
}
