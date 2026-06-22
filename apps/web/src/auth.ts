import NextAuth from 'next-auth';
import authConfig from './auth.config';
import { upsertDiscordUser } from '@inazuma/db';

// Full server-only auth config with DB callbacks.
// Middleware uses auth.config.ts directly to avoid pulling Node.js modules into the Edge bundle.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ profile }) {
      if (!profile) return false;
      const raw = profile as Record<string, unknown>;
      const discordId = String(raw.id ?? '');
      if (!discordId) return false;

      const avatarHash = raw.avatar;
      const avatarUrl = typeof avatarHash === 'string'
        ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.webp?size=128`
        : null;

      const blocked = await upsertDiscordUser({
        discordId,
        username: String(raw.username ?? ''),
        displayName: String(raw.global_name ?? raw.username ?? ''),
        avatarUrl,
      });

      return !blocked;
    },
  },
});
