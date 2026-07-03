'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_D, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import { createAwardAction, type AdminFormState } from '@/app/admin/actions';

// One-click starters for the league's traditional awards. Create, then use
// "Edit" on the award to add the edition (e.g. "Blaze's Golden Boot XV").

const PRESETS = [
  { icon: '🥇', name: 'Golden Boot', description: 'Top goal-scorer of the Frontier' },
  { icon: '👑', name: 'Top Assister', description: 'Most assists in the Frontier' },
  { icon: '🧱', name: 'Best Defender', description: 'Top voted defender — one nominee per team' },
  { icon: '🧤', name: 'Golden Glove', description: 'Best goalkeeper — highest average match rating' },
  { icon: '❄️', name: 'Player of the Tournament', description: 'Top voted player — one nominee per team' },
  { icon: '🏆', name: 'Frontier Champion', description: 'Won the Inazuma Frontier' },
  { icon: '🎖️', name: 'Mr Inazuma', description: 'Captain of the Frontier winners' },
];

function PresetChip({ preset }: { preset: (typeof PRESETS)[number] }) {
  const [state, action] = useFormState<AdminFormState, FormData>(createAwardAction, {});
  const Chip = () => {
    const { pending } = useFormStatus();
    return (
      <button
        type="submit"
        disabled={pending}
        title={preset.description}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 14px',
          background: state.ok ? rgba(T.win, 0.12) : 'rgba(255,255,255,0.05)',
          border: `1px solid ${state.ok ? rgba(T.win, 0.4) : 'rgba(255,255,255,0.14)'}`,
          borderRadius: 999,
          color: state.ok ? T.win : T.text,
          fontFamily: FONT_B,
          fontSize: 13,
          cursor: pending || state.ok ? 'default' : 'pointer',
          opacity: pending ? 0.6 : 1,
        }}
      >
        <span>{preset.icon}</span>
        {state.ok ? `${preset.name} ✓` : preset.name}
      </button>
    );
  };
  return (
    <form action={action} style={{ display: 'inline-flex' }}>
      <input type="hidden" name="name" value={preset.name} />
      <input type="hidden" name="icon" value={preset.icon} />
      <input type="hidden" name="description" value={preset.description} />
      <Chip />
    </form>
  );
}

export default function AwardPresets() {
  return (
    <div style={{ ...glass({ padding: 18 }), marginBottom: 20 }}>
      <div style={{ fontFamily: FONT_D, fontSize: 13, letterSpacing: 1.5, color: ADMIN_ACCENT, marginBottom: 4 }}>
        QUICK ADD — LEAGUE CLASSICS
      </div>
      <p style={{ fontFamily: FONT_B, fontSize: 12.5, color: T.faint, margin: '0 0 12px' }}>
        Tap to create, then open the award to rename it with its edition (e.g. “Blaze&apos;s Golden Boot XV”).
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PRESETS.map(p => <PresetChip key={p.name} preset={p} />)}
      </div>
    </div>
  );
}
