import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Next.js looks for .env.local in the app directory (apps/web/).
// In this monorepo the file lives at the repo root — parse it here so
// DATABASE_URL is in process.env before the dev server / routes start.
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(resolve(__dirname, '../../.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // No root .env.local — rely on Vercel env vars or apps/web/.env.local
}

/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@inazuma/db', '@inazuma/core'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com', pathname: '/avatars/**' },
    ],
  },
};

export default config;
