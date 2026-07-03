'use client';
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { Bolt } from '@/components/ui/Bolt';
import { FONT_B, FONT_D, FONT_M, T, glass, rgba } from '@/lib/realm-colors';

const ACCENT = '#FFD24A';
const BLURPLE = '#5865F2';

// iPhone / Android / iPadOS (which masquerades as a Mac but reports touch points).
function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

function DiscordGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 55) / 71} viewBox="0 0 71 55" fill="white">
      <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.292408 45.3914C0.29800 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z" />
    </svg>
  );
}

// Sign-in splash. Every path here ends at Discord's authorize screen:
//
// - The GUARANTEED route is /signin/go — a plain navigation the server answers
//   with a 302 to Discord. No client JS involved, works on every browser.
// - On phones the button shows IMMEDIATELY, pointing at that route. In the
//   background we try to fetch the direct discord.com authorize URL
//   (signIn redirect:false); if it arrives, the button upgrades to it so a
//   tap can hand off to the native Discord app. If it never arrives, the
//   button still works — nobody waits on JavaScript.
// - On desktop we auto-continue with the fetched URL, fall back to /signin/go
//   on any failure, and always show a manual link as an escape hatch.
export default function AutoSignIn({ next }: { next: string }) {
  const goUrl = `/signin/go?next=${encodeURIComponent(next)}`;
  const [mobile, setMobile] = useState<boolean | null>(null);
  const [directUrl, setDirectUrl] = useState<string | null>(null);

  useEffect(() => {
    const m = isMobile();
    setMobile(m);

    let cancelled = false;
    (async () => {
      try {
        const res = (await signIn('discord', { redirect: false, callbackUrl: next })) as
          unknown as { url?: string; error?: string | null } | undefined;
        if (cancelled) return;
        if (res?.error || !res?.url) throw new Error(res?.error ?? 'no authorize url');
        if (m) {
          // Upgrade the button to the direct discord.com link — a real tap on
          // it is what lets iOS/Android open the Discord app.
          setDirectUrl(res.url);
        } else {
          window.location.href = res.url;
        }
      } catch {
        if (cancelled) return;
        // Desktop: fall through to the server-side path automatically.
        // Mobile: nothing to do — the button already points there.
        if (!m) window.location.assign(goUrl);
      }
    })();
    return () => { cancelled = true; };
  }, [next, goUrl]);

  const showButton = mobile === true;

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

        {showButton ? (
          <>
            <a
              href={directUrl ?? goUrl}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '13px 26px', marginTop: 20,
                background: BLURPLE, border: 'none', borderRadius: 12,
                color: '#fff', textDecoration: 'none',
                fontFamily: FONT_D, fontSize: 15, letterSpacing: 1,
                boxShadow: '0 0 28px rgba(88,101,242,0.45)',
              }}
            >
              <DiscordGlyph />
              CONTINUE WITH DISCORD
            </a>
            <p style={{ fontFamily: FONT_M, color: T.faint, fontSize: 11, margin: '14px 0 0', letterSpacing: 0.4 }}>
              {directUrl ? 'Opens the Discord app if it’s installed.' : 'Continues in your browser.'}
            </p>
          </>
        ) : (
          <>
            <p style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, margin: '10px 0 0' }}>
              Connecting to Discord…
            </p>
            <p style={{ fontFamily: FONT_M, fontSize: 11, margin: '16px 0 0', letterSpacing: 0.4 }}>
              <a href={goUrl} style={{ color: T.faint, textDecorationColor: rgba(ACCENT, 0.5) }}>
                Not redirecting? Tap here.
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
