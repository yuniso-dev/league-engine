import { cache } from 'react';
import { getUserByDiscordId } from '@inazuma/db';

// Per-request dedupe: several layers of one render (page guard, layout,
// API route) can ask for the same viewer without repeating the query.
export const getCachedUserByDiscordId = cache(getUserByDiscordId);
