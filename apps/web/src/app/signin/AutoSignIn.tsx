'use client';
import { useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { Bolt } from '@/components/ui/Bolt';
import { FONT_B, FONT_D, T, glass, rgba } from '@/lib/realm-colors';

const ACCENT = '#FFD24A';

// Fires the Discord OAuth redirect immediately on mount — this page is only a
// branded splash for the split second before Discord's authorize screen loads.
export default function AutoSignIn({ next }: { next: string }) {
  useEffect(() => {
    void signIn('discord', { callbackUrl: next });
  }, [next]);

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #09091f 0%, #04050c 55%, #0a0412 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <div style={glass({ padding: '36px 44px', borderRadius: 22, textAlign: 'center' })}>
        <Bolt size={40} color={ACCENT} style={{ filter: `drop-shadow(0 0 18px ${rgba(ACCENT, 0.6)})` }} />
        <div style={{ fontFamily: FONT_D, color: T.text, fontSize: 20, letterSpacing: 2, marginTop: 14 }}>
          INAZUMA <span style={{ color: ACCENT }}>FC</span>
        </div>
        <p style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, margin: '10px 0 0' }}>
          Connecting to Discord…
        </p>
      </div>
    </div>
  );
}
