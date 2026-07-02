import type { PublicAward } from '@inazuma/db';
import { T, FONT_B, rgba } from '@/lib/realm-colors';

type Props = { awards: PublicAward[] };

export function AwardsBadgeRow({ awards }: Props) {
  if (awards.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {awards.map(a => (
        <span
          key={a.id}
          title={a.description ?? undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: rgba(T.gold, 0.12),
            border: `1px solid ${rgba(T.gold, 0.3)}`,
            padding: '5px 11px',
            borderRadius: 8,
            fontFamily: FONT_B,
            fontSize: 12,
            color: T.text,
          }}
        >
          {a.icon && <span>{a.icon}</span>}
          {a.name}
        </span>
      ))}
    </div>
  );
}
