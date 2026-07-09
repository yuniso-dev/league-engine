'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { HallTournament, LegacyHallEdition } from '@inazuma/db';
import { glass, T, FONT_D, FONT_B, FONT_M, rgba, lighten } from '@/lib/realm-colors';
import { AwardBadgeIcon } from '@/components/AwardsBadgeRow';

const GOLD = T.gold;

type SeasonGroup = { season: number; tournaments: HallTournament[] };
type Props = { real: SeasonGroup[]; legacy: LegacyHallEdition[] };

const LEGACY_ORDER = ['champion', 'golden_boot', 'wallside', 'sharps', 'xavier_frost'] as const;
const LEGACY_META: Record<string, { icon: string; label: string }> = {
  champion: { icon: '🏆', label: 'Champions' },
  golden_boot: { icon: '⚽', label: 'Golden Boot' },
  wallside: { icon: '🧱', label: 'Wallside' },
  sharps: { icon: '👟', label: "Sharp's" },
  xavier_frost: { icon: '❄️', label: 'Xavier Frost' },
};

function Plaque({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      ...glass({ padding: 24, borderRadius: 20 }),
      border: `1px solid ${rgba(GOLD, 0.28)}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -70, left: '50%', transform: 'translateX(-50%)',
        width: 260, height: 200, pointerEvents: 'none',
        background: `radial-gradient(circle, ${rgba(GOLD, 0.13)}, transparent 70%)`,
      }} />
      {children}
    </div>
  );
}

function honourCard(key: string, label: string, name: React.ReactNode) {
  return (
    <div key={key} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', borderRadius: 12,
      background: rgba(GOLD, 0.06), border: `1px solid ${rgba(GOLD, 0.2)}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: FONT_M, fontSize: 9, letterSpacing: 1, color: rgba(GOLD, 0.85),
          textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
        <span style={{ fontFamily: FONT_B, fontSize: 13.5, fontWeight: 700, color: T.text }}>{name}</span>
      </div>
    </div>
  );
}

function FrontierPlaque({ t }: { t: HallTournament }) {
  return (
    <Plaque>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', position: 'relative' }}>
        <Link href={`/frontier/${t.id}`} style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: FONT_D, fontSize: 22, letterSpacing: 1, color: T.text }}>{t.name.toUpperCase()}</span>
        </Link>
        {t.startDate && <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint }}>{t.startDate}</span>}
      </div>

      {t.championTeam && (
        <div style={{ marginTop: 14, position: 'relative' }}>
          <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 2, color: T.faint }}>🏆 CHAMPIONS</div>
          <div style={{
            fontFamily: FONT_D, fontSize: 26, letterSpacing: 1, marginTop: 4,
            background: `linear-gradient(120deg, ${GOLD}, ${lighten(GOLD, 0.35)})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {t.championTeam}
          </div>
          {t.championRoster.length > 0 && (
            <div style={{ fontFamily: FONT_B, fontSize: 12.5, color: T.dim, marginTop: 6, lineHeight: 1.7 }}>
              {t.championRoster.join(' · ')}
            </div>
          )}
        </div>
      )}

      {t.awards.length > 0 && (
        <div style={{ marginTop: 18, position: 'relative' }}>
          <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 2, color: T.faint, marginBottom: 8 }}>HONOURS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {t.awards.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12,
                background: rgba(GOLD, 0.06), border: `1px solid ${rgba(GOLD, 0.2)}`,
              }}>
                <AwardBadgeIcon imageUrl={a.imageUrl} icon={a.icon} size={22} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontFamily: FONT_M, fontSize: 9, letterSpacing: 1, color: rgba(GOLD, 0.85),
                    textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.name}
                  </div>
                  {a.playerPublicId ? (
                    <Link href={`/p/${a.playerPublicId}`} style={{ textDecoration: 'none' }}>
                      <span style={{ fontFamily: FONT_B, fontSize: 13.5, fontWeight: 700, color: T.text }}>{a.playerName}</span>
                    </Link>
                  ) : (
                    <span style={{ fontFamily: FONT_B, fontSize: 13.5, fontWeight: 700, color: T.text }}>{a.playerName}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Plaque>
  );
}

function LegacyName({ name, publicId, discordId }: { name: string | null; publicId: string | null; discordId: string }) {
  const label = name ?? `id:${discordId.slice(-5)}`;
  if (publicId) {
    return (
      <Link href={`/p/${publicId}`} style={{ textDecoration: 'none' }}>
        <span style={{ color: T.text }}>{label}</span>
      </Link>
    );
  }
  return <span style={{ color: name ? T.text : T.faint }}>{label}</span>;
}

function LegacyPlaque({ e }: { e: LegacyHallEdition }) {
  const champions = e.winners.filter(w => w.category === 'champion');
  const honours = LEGACY_ORDER.filter(c => c !== 'champion').flatMap(cat =>
    e.winners.filter(w => w.category === cat).map((w, i) => honourCard(
      `${cat}-${i}`,
      LEGACY_META[cat].label,
      <LegacyName name={w.displayName} publicId={w.publicId} discordId={w.discordId} />,
    )),
  );

  return (
    <Plaque>
      <div style={{ fontFamily: FONT_D, fontSize: 22, letterSpacing: 1, color: T.text, position: 'relative' }}>
        {e.label.toUpperCase()}
      </div>

      {champions.length > 0 && (
        <div style={{ marginTop: 14, position: 'relative' }}>
          <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 2, color: T.faint }}>🏆 CHAMPIONS</div>
          <div style={{ fontFamily: FONT_B, fontSize: 13, color: T.dim, marginTop: 6, lineHeight: 1.8 }}>
            {champions.map((w, i) => (
              <span key={w.discordId + i}>
                {i > 0 && <span style={{ color: T.faint }}> · </span>}
                <LegacyName name={w.displayName} publicId={w.publicId} discordId={w.discordId} />
              </span>
            ))}
          </div>
        </div>
      )}

      {honours.length > 0 && (
        <div style={{ marginTop: 18, position: 'relative' }}>
          <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 2, color: T.faint, marginBottom: 8 }}>HONOURS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {honours}
          </div>
        </div>
      )}
    </Plaque>
  );
}

export default function HallOfFameView({ real, legacy }: Props) {
  const options = [
    ...real.map(g => ({ key: `s${g.season}`, label: g.season === 0 ? 'Season 0 · Beta' : `Season ${g.season}` })),
    ...(legacy.length ? [{ key: 'legacy', label: 'Legacy' }] : []),
  ];
  const [selected, setSelected] = useState(options[0]?.key ?? '');

  if (options.length === 0) {
    return (
      <div style={{ ...glass({ padding: 44, borderRadius: 22, textAlign: 'center' }), border: '1px dashed rgba(255,210,74,0.25)' }}>
        <div style={{ fontFamily: FONT_D, fontSize: 18, letterSpacing: 3, color: T.dim }}>
          THE HALL AWAITS ITS FIRST LEGENDS
        </div>
        <p style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, margin: '10px 0 0', lineHeight: 1.8, letterSpacing: 0.5 }}>
          No Frontier has been completed yet. Someone will lift the first trophy.
        </p>
      </div>
    );
  }

  const legacySelected = selected === 'legacy';
  const group = real.find(g => `s${g.season}` === selected);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{
            appearance: 'none',
            padding: '10px 40px 10px 18px',
            background: `${rgba(GOLD, 0.08)} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23d4a017' d='M1 1l5 5 5-5'/%3E%3C/svg%3E") no-repeat right 16px center`,
            border: `1px solid ${rgba(GOLD, 0.4)}`,
            borderRadius: 12,
            color: GOLD,
            fontFamily: FONT_D,
            fontSize: 15,
            letterSpacing: 2,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {options.map(o => (
            <option key={o.key} value={o.key} style={{ background: '#12100a', color: '#fff' }}>
              {o.label.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {legacySelected
          ? legacy.map(e => <LegacyPlaque key={e.edition} e={e} />)
          : (group?.tournaments ?? []).map(t => <FrontierPlaque key={t.id} t={t} />)}
      </div>
    </>
  );
}
