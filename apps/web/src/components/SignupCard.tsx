'use client';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import type { PublicSignup } from '@inazuma/db';
import { Avatar } from '@/components/ui/Avatar';
import { Bolt } from '@/components/ui/Bolt';
import { FlagIcon } from '@/components/ui/FlagIcon';
import { T, FONT_B, FONT_D, FONT_M, glass, rgba, lighten } from '@/lib/realm-colors';
import { signUpAction, withdrawAction, type SignupFormState } from '@/app/frontier/actions';

// The roster call: who's in for this Frontier, who's actually in voice right
// now (live via the Discord bot), and the sign-up / withdraw button.

const LIVE = '#3DDC97';

type Props = {
  tournamentId: string;
  status: 'upcoming' | 'live' | 'completed';
  isLoggedIn: boolean;
  signedUp: boolean;
  signups: PublicSignup[];
};

function SubmitButton({ label, primary }: { label: string; primary: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={primary ? {
        padding: '13px 28px',
        background: `linear-gradient(120deg, ${T.gold}, ${lighten(T.gold, 0.25)})`,
        border: 'none',
        borderRadius: 12,
        color: '#191203',
        fontFamily: FONT_D,
        fontSize: 15,
        letterSpacing: 1.5,
        cursor: pending ? 'not-allowed' : 'pointer',
        boxShadow: `0 0 26px ${rgba(T.gold, 0.45)}`,
        opacity: pending ? 0.7 : 1,
      } : {
        padding: '11px 22px',
        background: 'none',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 12,
        color: T.dim,
        fontFamily: FONT_D,
        fontSize: 13,
        letterSpacing: 1.5,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? '…' : label}
    </button>
  );
}

function SignUpForm({ tournamentId }: { tournamentId: string }) {
  const [state, action] = useFormState<SignupFormState, FormData>(signUpAction, {});
  return (
    <form action={action} style={{ display: 'inline-flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <SubmitButton label="⚡ SIGN UP" primary />
      {state.error && (
        <span style={{ fontFamily: FONT_B, fontSize: 13, color: T.loss }}>{state.error}</span>
      )}
    </form>
  );
}

function WithdrawForm({ tournamentId }: { tournamentId: string }) {
  const [state, action] = useFormState<SignupFormState, FormData>(withdrawAction, {});
  return (
    <form action={action} style={{ display: 'inline-flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <span style={{ fontFamily: FONT_B, fontSize: 13, color: T.win }}>✓ You&apos;re on the list</span>
      <SubmitButton label="✕ WITHDRAW" primary={false} />
      {state.error && (
        <span style={{ fontFamily: FONT_B, fontSize: 13, color: T.loss }}>{state.error}</span>
      )}
    </form>
  );
}

export function SignupCard({ tournamentId, status, isLoggedIn, signedUp, signups }: Props) {
  const inVoice = signups.filter(s => s.inVoice).length;
  const open = status === 'upcoming';
  if (!open && signups.length === 0) return null;

  return (
    <div style={{
      ...glass({ padding: 22, borderRadius: 22 }),
      marginBottom: 16,
      border: `1px solid ${rgba(T.gold, 0.3)}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -60, right: -40, width: 200, height: 200, pointerEvents: 'none',
        background: `radial-gradient(circle, ${rgba(T.gold, 0.14)}, transparent 70%)`,
      }} />

      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'relative' }}>
        <Bolt size={16} color={T.gold} />
        <h2 style={{ fontFamily: FONT_D, color: T.gold, fontSize: 17, letterSpacing: 2, margin: 0 }}>
          ROSTER CALL
        </h2>
        <span style={{ fontFamily: FONT_D, fontSize: 17, color: T.text }}>
          {signups.length}
          <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint, marginLeft: 4 }}>SIGNED UP</span>
        </span>
        {inVoice > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: LIVE,
              boxShadow: `0 0 10px ${LIVE}`, animation: 'voicePulse 1.6s ease-in-out infinite',
            }} />
            <span style={{ fontFamily: FONT_M, fontSize: 11, color: LIVE }}>
              {inVoice} IN VOICE NOW
            </span>
          </span>
        )}
      </div>

      <p style={{ fontFamily: FONT_B, fontSize: 13, color: T.dim, margin: '8px 0 0', position: 'relative' }}>
        {open
          ? 'Throw your name in — teams are drafted from this list on the day.'
          : 'Signups are closed — the Frontier is underway.'}
      </p>

      {/* roster chips */}
      {signups.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, position: 'relative' }}>
          {signups.map(s => (
            <span
              key={s.publicId}
              title={s.inVoice ? `${s.displayName} — in voice now` : s.displayName}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: s.inVoice ? rgba(LIVE, 0.08) : 'rgba(255,255,255,0.05)',
                border: `1px solid ${s.inVoice ? rgba(LIVE, 0.45) : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 999, padding: '3px 11px 3px 4px',
              }}
            >
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <Avatar initials={s.displayName.slice(0, 2).toUpperCase()} src={s.avatarUrl} size={24} />
                {s.inVoice && (
                  <span style={{
                    position: 'absolute', bottom: -1, right: -1,
                    width: 9, height: 9, borderRadius: '50%',
                    background: LIVE, border: '2px solid #0a0d16',
                    animation: 'voicePulse 1.6s ease-in-out infinite',
                  }} />
                )}
              </span>
              <span style={{ fontFamily: FONT_B, fontSize: 12.5, color: T.text }}>{s.displayName}</span>
              <FlagIcon code={s.country} size={13} />
              {!s.hidePositions && s.position1 && (
                <span style={{ fontFamily: FONT_M, fontSize: 9.5, color: T.faint }}>
                  {s.position1}{s.position2 ? `/${s.position2}` : ''}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      {signups.length === 0 && open && (
        <p style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, margin: '14px 0 0', letterSpacing: 0.5, position: 'relative' }}>
          Nobody yet. Be the first name on the teamsheet.
        </p>
      )}

      {/* CTA */}
      {open && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18, flexWrap: 'wrap', position: 'relative' }}>
          {isLoggedIn ? (
            signedUp ? <WithdrawForm tournamentId={tournamentId} /> : <SignUpForm tournamentId={tournamentId} />
          ) : (
            <Link
              href={`/signin?next=${encodeURIComponent(`/frontier/${tournamentId}`)}`}
              style={{
                padding: '12px 24px',
                background: '#5865F2',
                borderRadius: 12,
                color: '#fff',
                textDecoration: 'none',
                fontFamily: FONT_D,
                fontSize: 14,
                letterSpacing: 1,
                boxShadow: '0 0 22px rgba(88,101,242,0.4)',
              }}
            >
              SIGN IN TO JOIN
            </Link>
          )}
          <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint, letterSpacing: 0.4 }}>
            Be in the Discord voice channel on the day — drafts pick from who&apos;s present.
          </span>
        </div>
      )}
      <style>{'@keyframes voicePulse{0%,100%{opacity:0.55}50%{opacity:1}}'}</style>
    </div>
  );
}
