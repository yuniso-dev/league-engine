'use client';
import { FONT_D, FONT_B, glass, T } from '@/lib/realm-colors';
import { POSITIONS } from '@/lib/positions';

type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultDisplayName: string;
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

const input: React.CSSProperties = {
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

const select: React.CSSProperties = { ...input, cursor: 'pointer' };

const posOptions = (
  <>
    <option value="">— None —</option>
    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
  </>
);

export default function InitialiseForm({ action, defaultDisplayName }: Props) {
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
            SET UP YOUR PROFILE
          </h1>
          <p style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, margin: '0 0 28px' }}>
            This is how you'll appear in INAZUMA FC.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={label}>Display Name</label>
              <input
                name="displayName"
                defaultValue={defaultDisplayName}
                maxLength={32}
                required
                autoComplete="off"
                style={input}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={label}>Primary Position</label>
                <select name="position1" style={select}>{posOptions}</select>
              </div>
              <div>
                <label style={label}>Secondary Position</label>
                <select name="position2" style={select}>{posOptions}</select>
              </div>
            </div>

            <div>
              <label style={label}>Country (2-letter code)</label>
              <input
                name="country"
                maxLength={2}
                placeholder="e.g. GB"
                style={{ ...input, textTransform: 'uppercase' }}
                onChange={e => { e.target.value = e.target.value.toUpperCase(); }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" name="hidePositions" style={{ width: 16, height: 16, accentColor: '#FF7A1A' }} />
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
            JOIN THE LEAGUE
          </button>
        </div>
      </form>
    </div>
  );
}
