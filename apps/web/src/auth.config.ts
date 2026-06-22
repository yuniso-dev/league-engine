import type { NextAuthConfig } from 'next-auth';
import Discord from 'next-auth/providers/discord';

// Edge-safe config — no Node.js modules, no DB imports.
// Used by middleware and re-spread into the full auth.ts config.
export default {
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.discordId = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
