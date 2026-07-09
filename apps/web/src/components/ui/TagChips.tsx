import type { PlayerTag } from '@inazuma/db';
import { FONT_M } from '@/lib/realm-colors';

// Small profile tags: Legacy (won in the old, pre-website Frontier) and Beta
// (played the test/Season-0 frontier). Pure + server-safe, shared by the
// rankings rows and the profile header.

const META: Record<PlayerTag, { icon: string; label: string; color: string }> = {
  legacy: { icon: '🏛️', label: 'LEGACY', color: '#d4a017' },
  beta: { icon: '🧪', label: 'BETA', color: '#7aa2ff' },
};

export function TagChips({ tags, compact = false }: { tags?: PlayerTag[]; compact?: boolean }) {
  if (!tags || tags.length === 0) return null;
  return (
    <>
      {tags.map(t => {
        const m = META[t];
        return (
          <span
            key={t}
            title={m.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontFamily: FONT_M,
              fontSize: compact ? 8.5 : 10,
              letterSpacing: 0.8,
              color: m.color,
              background: `${m.color}1f`,
              border: `1px solid ${m.color}55`,
              borderRadius: 5,
              padding: compact ? '1px 5px' : '2px 7px',
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: compact ? 9 : 11 }}>{m.icon}</span>
            {compact ? '' : m.label}
          </span>
        );
      })}
    </>
  );
}
