'use client';
import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { FONT_D, FONT_B, glass, T } from '@/lib/realm-colors';
import { POSITIONS } from '@/lib/positions';
import { COUNTRIES } from '@/lib/countries';
import { BackPill } from '@/components/ui/BackPill';
import { FlagIcon } from '@/components/ui/FlagIcon';
import GlassSelect from '@/components/ui/GlassSelect';
import HueWheel from '@/components/ui/HueWheel';
import type { UserRow } from '@inazuma/db';

const POSITION_OPTIONS = [
  { value: '', label: '— None —' },
  ...POSITIONS.map(p => ({ value: p, label: p })),
];

// Flag IMAGES, not emoji — Windows renders flag emoji as bare letter pairs
// ("GB"), so the picker shows the country name with a real flag beside it.
const COUNTRY_OPTIONS = [
  { value: '', label: '— None —' },
  ...COUNTRIES.map(c => ({
    value: c.code,
    label: c.name,
    icon: <FlagIcon code={c.code} size={20} />,
  })),
];

type Props = {
  action: (formData: FormData) => Promise<void>;
  user: UserRow;
};

const ACCENT = '#FF7A1A';

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: FONT_B,
  fontSize: 12,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: T.dim,
  marginBottom: 6,
};

const inputBase: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  padding: '10px 14px',
  color: T.text,
  fontFamily: FONT_B,
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  const [saved, setSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        marginTop: 28,
        width: '100%',
        padding: '13px 0',
        background: saved ? '#1a8a3a' : ACCENT,
        border: 'none',
        borderRadius: 12,
        color: '#fff',
        fontFamily: FONT_D,
        fontSize: 16,
        letterSpacing: 2,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.7 : 1,
        transition: 'background 0.3s, opacity 0.2s',
      }}
    >
      {pending ? 'SAVING…' : saved ? 'SAVED ✓' : 'SAVE CHANGES'}
    </button>
  );
}

export default function SettingsForm({ action, user }: Props) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'radial-gradient(ellipse at 50% 80%, #3A1A08 0%, #120703 60%, #04050c 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <form action={action} style={{ width: '100%', maxWidth: 460 }}>
        <div style={glass({ padding: 36, borderRadius: 22 })}>
          <h1 style={{
            fontFamily: FONT_D, fontSize: 28, color: ACCENT,
            margin: '0 0 4px', letterSpacing: 2,
          }}>
            EDIT PROFILE
          </h1>
          <p style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, margin: '0 0 28px' }}>
            This is your player card — changes take effect immediately.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={labelStyle}>Display Name</label>
              <input
                name="displayName"
                defaultValue={user.displayName}
                maxLength={32}
                required
                autoComplete="off"
                style={inputBase}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Primary Position</label>
                <GlassSelect
                  name="position1"
                  options={POSITION_OPTIONS}
                  defaultValue={user.position1 ?? ''}
                  accent={ACCENT}
                />
              </div>
              <div>
                <label style={labelStyle}>Secondary Position</label>
                <GlassSelect
                  name="position2"
                  options={POSITION_OPTIONS}
                  defaultValue={user.position2 ?? ''}
                  accent={ACCENT}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Country</label>
              <GlassSelect
                name="country"
                options={COUNTRY_OPTIONS}
                defaultValue={user.country ?? ''}
                accent={ACCENT}
                searchable
              />
            </div>

            <div>
              <label style={labelStyle}>EA ID <span style={{ color: T.faint, textTransform: 'none', letterSpacing: 0 }}>(FC Clubs persona)</span></label>
              <input
                name="eaName"
                defaultValue={user.eaName ?? ''}
                maxLength={32}
                placeholder="Your in-game Clubs name…"
                autoComplete="off"
                style={inputBase}
              />
              <p style={{ fontFamily: FONT_B, fontSize: 11.5, color: T.faint, margin: '6px 0 0', lineHeight: 1.5 }}>
                Exactly as it appears in FC Clubs — links your casual club matches
                to your profile and the Casual leaderboard.
              </p>
            </div>

            <div>
              <label style={labelStyle}>Accent Colour</label>
              <HueWheel name="accentColor" defaultValue={user.accentColor} />
            </div>

            <div>
              <label style={labelStyle}>Quote</label>
              <input
                name="quote"
                defaultValue={user.quote ?? ''}
                maxLength={100}
                placeholder="A short quote..."
                style={inputBase}
              />
            </div>

            <div>
              <label style={labelStyle}>Bio</label>
              <textarea
                name="bio"
                defaultValue={user.bio ?? ''}
                maxLength={300}
                rows={3}
                placeholder="Tell the league about yourself..."
                style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="hidePositions"
                defaultChecked={user.hidePositions}
                style={{ width: 16, height: 16, accentColor: ACCENT }}
              />
              <span style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14 }}>
                Hide positions from my nickname
              </span>
            </label>
          </div>

          <SubmitButton />
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <BackPill href="/" label="BACK TO INAZUMA FC" accent={ACCENT} />
        </div>
      </form>
    </div>
  );
}
