import type { PublicAward } from '@inazuma/db';
import { T, FONT_B, FONT_D, FONT_M, rgba } from '@/lib/realm-colors';

// Trophy-cabinet treatment for profile awards: gold-lit cards with the icon
// front and centre, edition/tournament caption underneath.

function AwardIcon({ imageUrl, icon }: { imageUrl: string | null; icon: string | null }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        width={40}
        height={40}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{ objectFit: 'cover', borderRadius: 10, display: 'block' }}
      />
    );
  }
  return <span style={{ fontSize: 30, lineHeight: 1 }}>{icon ?? '🏅'}</span>;
}

export function AwardShowcase({ awards, accent = T.gold }: { awards: PublicAward[]; accent?: string }) {
  if (awards.length === 0) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: 10,
    }}>
      {awards.map(a => (
        <div
          key={a.id}
          title={a.description ?? undefined}
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: '16px 12px 13px',
            textAlign: 'center',
            borderRadius: 14,
            background: `linear-gradient(160deg, ${rgba(accent, 0.13)}, rgba(255,255,255,0.03) 55%)`,
            border: `1px solid ${rgba(accent, 0.35)}`,
            boxShadow: `inset 0 1px 0 ${rgba(accent, 0.25)}`,
          }}
        >
          {/* soft glow behind the trophy */}
          <div style={{
            position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
            width: 90, height: 90, pointerEvents: 'none',
            background: `radial-gradient(circle, ${rgba(accent, 0.28)}, transparent 70%)`,
          }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <AwardIcon imageUrl={a.imageUrl} icon={a.icon} />
          </div>
          <div style={{
            position: 'relative',
            fontFamily: FONT_D,
            fontSize: 12.5,
            letterSpacing: 0.6,
            color: T.text,
            lineHeight: 1.3,
          }}>
            {a.name}
          </div>
          {(a.tournamentName || a.season) && (
            <div style={{
              position: 'relative',
              fontFamily: FONT_M,
              fontSize: 9,
              letterSpacing: 1,
              color: rgba(accent, 0.85),
              marginTop: 5,
              textTransform: 'uppercase',
            }}>
              {a.tournamentName ?? `Season ${a.season}`}
            </div>
          )}
          {a.description && (
            <div style={{
              position: 'relative',
              fontFamily: FONT_B,
              fontSize: 10.5,
              color: T.faint,
              marginTop: 4,
              lineHeight: 1.35,
            }}>
              {a.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
