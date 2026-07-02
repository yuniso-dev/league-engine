import NextAuth from 'next-auth';
import authConfig from '@/auth.config';

// Use the Edge-safe config (no DB imports) so the middleware bundle stays within
// the Edge Runtime constraints. The signIn DB callback lives in auth.ts only.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL('/api/auth/signin', req.url));
  }
});

// /admin gets the signed-in check here; the role check needs the DB, so it
// lives in requireAdmin()/requireAdminAction() on the server side.
export const config = { matcher: ['/initialise', '/settings', '/admin/:path*'] };
