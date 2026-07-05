'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PublicPlayer } from '@inazuma/db';
import { Avatar } from '@/components/ui/Avatar';
import { FONT_B, FONT_D, T, glass } from '@/lib/realm-colors';
import { doSignOut } from '@/app/auth-actions';

type Props = {
  currentUser: PublicPlayer | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
};

const ACCENT = '#FF7A1A';

const itemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '9px 14px',
  background: 'none',
  border: 'none',
  borderRadius: 9,
  color: T.text,
  fontFamily: FONT_B,
  fontSize: 14,
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'background 0.15s',
};

function MenuItem({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...itemStyle, color: danger ? '#FF6B6B' : T.text }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
    >
      {children}
    </button>
  );
}

export function AccountMenu({ currentUser, isLoggedIn, isAdmin }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isLoggedIn) {
    // Route through /signin (a real link, not a server 302) so mobile can hand
    // off to the Discord app; desktop redirects on through instantly.
    return (
      <Link
        href="/signin?next=%2F"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 13px',
          background: '#5865F2',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          textDecoration: 'none',
          fontFamily: FONT_B,
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.04em',
          cursor: 'pointer',
          boxShadow: '0 0 16px rgba(88,101,242,0.35)',
        }}
      >
        <svg width="14" height="11" viewBox="0 0 71 55" fill="white">
          <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.292408 45.3914C0.29800 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z" />
        </svg>
        Sign in
      </Link>
    );
  }

  const initials = currentUser
    ? currentUser.displayName.slice(0, 2).toUpperCase()
    : '?';

  const shareProfile = async () => {
    if (!currentUser?.publicId) return;
    const url = `${window.location.origin}/p/${currentUser.publicId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback for browsers that block clipboard without user gesture
      prompt('Copy your profile link:', url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: open ? `1.5px solid ${ACCENT}` : '1.5px solid transparent',
          borderRadius: '50%',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 0.2s',
          boxShadow: open ? `0 0 12px rgba(255,122,26,0.4)` : 'none',
        }}
      >
        <Avatar
          initials={initials}
          src={currentUser?.avatarUrl}
          size={32}
          ring={null}
        />
      </button>

      {open && (
        <>
          {/* backdrop — sits above swipe track (z:5) so taps close menu cleanly */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 19 }}
          />

          {/* dropdown */}
          <div style={{
            position: 'absolute',
            top: 40,
            right: 0,
            zIndex: 20,
            minWidth: 188,
            ...glass({ padding: 6, borderRadius: 14 }),
          }}>
            {currentUser && (
              <div style={{
                padding: '8px 14px 8px',
                marginBottom: 2,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontFamily: FONT_D, color: T.text, fontSize: 13, letterSpacing: 0.5 }}>
                  {currentUser.displayName}
                </div>
                <div style={{ fontFamily: FONT_B, color: T.faint, fontSize: 11, marginTop: 1 }}>
                  {currentUser.provisional ? 'Provisional' : `#${currentUser.rank} · ${Math.round(currentUser.elo)} ELO`}
                </div>
              </div>
            )}

            {isAdmin && (
              <MenuItem onClick={() => { setOpen(false); router.push('/admin'); }}>
                ⚡ Admin
              </MenuItem>
            )}

            <MenuItem onClick={() => { setOpen(false); router.push('/settings'); }}>
              🪪 Edit profile
            </MenuItem>

            {currentUser?.publicId && (
              <MenuItem onClick={shareProfile}>
                {copied ? '✓ Copied!' : '↗ Share profile'}
              </MenuItem>
            )}

            <MenuItem onClick={() => { setOpen(false); router.push('/guide'); }}>
              ❔ How it works
            </MenuItem>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 2, paddingTop: 2 }}>
              <form action={doSignOut}>
                <button
                  type="submit"
                  style={{ ...itemStyle, color: '#FF6B6B' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,107,107,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                >
                  ← Sign out
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
