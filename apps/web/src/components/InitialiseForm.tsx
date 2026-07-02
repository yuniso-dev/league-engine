'use client';
import { useState } from 'react';
import { FONT_D, FONT_B, FONT_M, glass, T, rgba } from '@/lib/realm-colors';
import { POSITIONS } from '@/lib/positions';

type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultDisplayName: string;
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

const inputStyle: React.CSSProperties = {
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

export default function InitialiseForm({ action, defaultDisplayName }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const togglePos = (pos: string) => {
    setSelected(prev => {
      const idx = prev.indexOf(pos);
      if (idx !== -1) return prev.filter(p => p !== pos);
      if (prev.length < 2) return [...prev, pos];
      return [prev[0], pos];
    });
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'radial-gradient(ellipse at 50% 80%, #3A1A08 0%, #120703 60%, #04050c 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <form action={action} style={{ width: '100%', maxWidth: 480 }}>
        <input type="hidden" name="position1" value={selected[0] ?? ''} />
        <input type="hidden" name="position2" value={selected[1] ?? ''} />

        <div style={glass({ padding: 36, borderRadius: 22 })}>
          <h1 style={{
            fontFamily: FONT_D, fontSize: 28, color: ACCENT,
            margin: '0 0 4px', letterSpacing: 2,
          }}>
            SET UP YOUR PROFILE
          </h1>
          <p style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, margin: '0 0 28px' }}>
            This is how you&apos;ll appear in INAZUMA FC.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={labelStyle}>Display Name</label>
              <input
                name="displayName"
                defaultValue={defaultDisplayName}
                maxLength={32}
                required
                autoComplete="off"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Your Position(s)</label>
              <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 12, margin: '0 0 12px' }}>
                Select 1 or 2 — click order sets priority
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
              }}>
                {POSITIONS.map(pos => {
                  const idx = selected.indexOf(pos);
                  const isFirst = idx === 0;
                  const isSecond = idx === 1;
                  const isSelected = idx !== -1;
                  const activeColor = isFirst ? ACCENT : 'rgba(255,122,26,0.7)';

                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => togglePos(pos)}
                      style={{
                        position: 'relative',
                        padding: '14px 4px',
                        background: isSelected
                          ? `rgba(255,122,26,${isFirst ? 0.18 : 0.10})`
                          : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isSelected ? (isFirst ? ACCENT : 'rgba(255,122,26,0.55)') : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 10,
                        color: isSelected ? (isFirst ? ACCENT : 'rgba(255,160,80,0.9)') : T.dim,
                        fontFamily: FONT_D,
                        fontSize: 14,
                        letterSpacing: 1,
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        boxShadow: isSelected
                          ? `0 4px 16px rgba(0,0,0,0.3), 0 0 ${isFirst ? 18 : 10}px rgba(255,122,26,${isFirst ? 0.5 : 0.28}), inset 0 0 8px rgba(255,122,26,0.08)`
                          : '0 4px 12px rgba(0,0,0,0.25)',
                        textAlign: 'center',
                      }}
                    >
                      {pos}
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          top: 4, right: 4,
                          width: 14, height: 14,
                          borderRadius: '50%',
                          background: isFirst ? ACCENT : 'rgba(255,122,26,0.7)',
                          color: '#fff',
                          fontSize: 8,
                          fontFamily: FONT_M,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1,
                        }}>
                          {idx + 1}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" name="hidePositions" style={{ width: 16, height: 16, accentColor: ACCENT }} />
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
              background: ACCENT,
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontFamily: FONT_D,
              fontSize: 16,
              letterSpacing: 2,
              cursor: 'pointer',
              boxShadow: `0 0 24px rgba(255,122,26,0.35)`,
            }}
          >
            JOIN THE LEAGUE
          </button>
        </div>
      </form>
    </div>
  );
}
