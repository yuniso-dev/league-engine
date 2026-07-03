'use client';
import { useEffect } from 'react';
import { Bolt } from '@/components/ui/Bolt';
import { FONT_D, FONT_B, FONT_M, T, glass } from '@/lib/realm-colors';

// App-wide error boundary. If a server render throws (e.g. a transient DB blip
// while Supabase spins a cold connection back up), the user gets a branded
// "retry" instead of a raw crash — or, worse, an eternal loading spinner.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface it in the server/function logs for diagnosis.
    console.error('[RootError]', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #09091f 0%, #04050c 55%, #0a0412 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ ...glass({ padding: 32, borderRadius: 20 }), maxWidth: 380, textAlign: 'center' }}>
        <span style={{ display: 'inline-block', animation: 'boltPulse 1.1s ease-in-out infinite' }}>
          <Bolt size={40} color="#FFD24A" />
        </span>
        <h1 style={{ fontFamily: FONT_D, color: T.text, fontSize: 22, letterSpacing: 1, margin: '16px 0 6px' }}>
          STORM INTERFERENCE
        </h1>
        <p style={{ fontFamily: FONT_B, color: T.dim, fontSize: 13, lineHeight: 1.6, margin: '0 0 20px' }}>
          We couldn&apos;t reach the server just now — this usually clears in a
          second while the database wakes up.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => reset()}
            style={{
              fontFamily: FONT_M, fontSize: 12, letterSpacing: 1,
              color: '#04060D', background: '#FFD24A',
              border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer',
            }}
          >
            RETRY
          </button>
          <a
            href="/"
            style={{
              fontFamily: FONT_M, fontSize: 12, letterSpacing: 1,
              color: T.dim, textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 18px',
            }}
          >
            HOME
          </a>
        </div>
      </div>
      <style>{'@keyframes boltPulse{0%,100%{opacity:0.4;transform:scale(0.94)}50%{opacity:1;transform:scale(1.06)}}'}</style>
    </div>
  );
}
