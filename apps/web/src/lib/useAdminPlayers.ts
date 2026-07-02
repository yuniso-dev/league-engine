'use client';
import { useEffect, useState } from 'react';
import type { AdminPlayerOption } from '@inazuma/db';

// Module-level cache: every picker on every admin page shares one fetch per
// browser session, and the list survives post-action RSC re-renders for free.
let cached: AdminPlayerOption[] | null = null;
let inflight: Promise<AdminPlayerOption[]> | null = null;

function fetchPlayers(): Promise<AdminPlayerOption[]> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch('/api/admin/players')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load players (${res.status})`);
        return res.json() as Promise<AdminPlayerOption[]>;
      })
      .then(players => {
        cached = players;
        return players;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useAdminPlayers(): {
  players: AdminPlayerOption[];
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const [players, setPlayers] = useState<AdminPlayerOption[]>(cached ?? []);
  const [loading, setLoading] = useState(cached === null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    if (!cached) setLoading(true);
    fetchPlayers()
      .then(list => {
        if (!alive) return;
        setPlayers(list);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  return {
    players,
    loading,
    error,
    retry: () => {
      cached = null;
      setAttempt(a => a + 1);
    },
  };
}
