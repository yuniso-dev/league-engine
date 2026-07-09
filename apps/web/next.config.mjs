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

// Single source of truth for the app version is apps/web/package.json.
// Read it at build time and hand it to the client as NEXT_PUBLIC_APP_VERSION
// so the UI can show which build is live. On Vercel the short commit SHA is
// appended (e.g. "0.1.0+a1b2c3d") so a rebuild of the same version is still
// distinguishable.
let appVersion = '0.0.0';
try {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
  appVersion = pkg.version ?? appVersion;
} catch {
  // package.json unreadable — fall back to the placeholder above.
}
const commitSha = process.env.VERCEL_GIT_COMMIT_SHA;
if (commitSha) appVersion += `+${commitSha.slice(0, 7)}`;

/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@inazuma/db', '@inazuma/core'],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com', pathname: '/avatars/**' },
    ],
  },
};

export default config;
