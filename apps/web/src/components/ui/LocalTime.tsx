'use client';
import { useEffect, useState } from 'react';

// Renders an absolute instant in the VIEWER's own timezone. The server can't
// know the visitor's zone, so it emits a stable UTC label for SSR and the
// client swaps in local time on mount (suppressHydrationWarning covers the
// intended mismatch). Kickoff times therefore read correctly for everyone.

const UTC_FMT: Intl.DateTimeFormatOptions = {
  weekday: 'short', day: 'numeric', month: 'short',
  hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
};
const LOCAL_FMT: Intl.DateTimeFormatOptions = {
  weekday: 'short', day: 'numeric', month: 'short',
  hour: '2-digit', minute: '2-digit',
};

export function LocalTime({ iso }: { iso: string }) {
  const d = new Date(iso);
  const [text, setText] = useState(() => `${d.toLocaleString(undefined, UTC_FMT)} UTC`);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const label = tz ? tz.split('/').pop()!.replace(/_/g, ' ') : 'local';
    setText(`${d.toLocaleString(undefined, LOCAL_FMT)} · ${label}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  return <span suppressHydrationWarning>{text}</span>;
}
