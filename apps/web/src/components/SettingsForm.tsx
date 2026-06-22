'use client';
import { FONT_D, FONT_B, glass, T } from '@/lib/realm-colors';
import { POSITIONS } from '@/lib/positions';
import type { UserRow } from '@inazuma/db';

type Props = {
  action: (formData: FormData) => Promise<void>;
  user: UserRow;
};

const label: React.CSSProperties = {
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

const posOptions = (current: string | null) => (
  <>
    <option value="">— None —</option>
    {POSITIONS.map(p => (
      <option key={p} value={p} selected={p === current}>{p}</option>
    ))}
  </>
);

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
            fontFamily: FONT_D, fontSize: 28, color: '#FF7A1A',
            margin: '0 0 4px', letterSpacing: 2,
          }}>
            SETTINGS
          </h1>
          <p style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, margin: '0 0 28px' }}>
            Changes take effect immediately.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={label}>Display Name</label>
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
                <label style={label}>Primary Position</label>
                <select name="position1" style={{ ...inputBase, cursor: 'pointer' }}>
                  {posOptions(user.position1)}
                </select>
              </div>
              <div>
                <label style={label}>Secondary Position</label>
                <select name="position2" style={{ ...inputBase, cursor: 'pointer' }}>
                  {posOptions(user.position2)}
                </select>
              </div>
            </div>

            <div>
              <label style={label}>Country (2-letter code)</label>
              <input
                name="country"
                defaultValue={user.country ?? ''}
                maxLength={2}
                placeholder="e.g. GB"
                style={{ ...inputBase, textTransform: 'uppercase' }}
                onChange={e => { e.target.value = e.target.value.toUpperCase(); }}
              />
            </div>

            <div>
              <label style={label}>Quote</label>
              <input
                name="quote"
                defaultValue={user.quote ?? ''}
                maxLength={100}
                placeholder="A short quote..."
                style={inputBase}
              />
            </div>

            <div>
              <label style={label}>Bio</label>
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
                style={{ width: 16, height: 16, accentColor: '#FF7A1A' }}
              />
              <span style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14 }}>
                Hide positions from my nickname
              </span>
            </label>
          </div>

          <button
            type="submit"
            style={{
              marginTop: 28,
              width: '100%',
              padding: '13px 0',
              background: '#FF7A1A',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontFamily: FONT_D,
              fontSize: 16,
              letterSpacing: 2,
              cursor: 'pointer',
            }}
          >
            SAVE CHANGES
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/" style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, textDecoration: 'none' }}>
            ← Back to INAZUMA FC
          </a>
        </div>
      </form>
    </div>
  );
}
