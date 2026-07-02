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
    jwt({ token, account }) {
      if (account?.providerAccountId) {
        token.discordId = account.providerAccountId;
      }
      return token;
    },
    session({ session, token }) {
      if (token.discordId) session.user.discordId = token.discordId as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
