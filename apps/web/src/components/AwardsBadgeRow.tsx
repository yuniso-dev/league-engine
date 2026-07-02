import type { PublicAward } from '@inazuma/db';
import { T, FONT_B, rgba } from '@/lib/realm-colors';

type Props = { awards: PublicAward[] };

// Plain <img> on purpose: award images come from arbitrary admin-chosen hosts,
// which next/image would need a wildcard remotePatterns entry for — turning the
// image optimizer into an open proxy for ~20px decorative icons.
export function AwardBadgeIcon({
  imageUrl,
  icon,
  size = 18,
}: {
  imageUrl: string | null;
  icon: string | null;
  size?: number;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        width={size}
        height={size}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{ objectFit: 'cover', borderRadius: size / 4, display: 'block', flexShrink: 0 }}
      />
    );
  }
  if (icon) return <span>{icon}</span>;
  return null;
}

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
          <AwardBadgeIcon imageUrl={a.imageUrl} icon={a.icon} />
          {a.name}
        </span>
      ))}
    </div>
  );
}
