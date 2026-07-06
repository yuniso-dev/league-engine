'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { HONOURS } from '@inazuma/core';
import { FONT_B, FONT_D, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import { createAwardAction, type AdminFormState } from '@/app/admin/actions';

// One-click starters for the league's standing honours (shared with the bot +
// ceremony page via @inazuma/core). These are the UN-numbered base awards; the
// per-edition ones ("Blaze's Boot XV") are minted by the tournament's ceremony
// page, so the two never collide.

const PRESETS = HONOURS.map(h => ({ icon: h.icon, name: h.base, description: h.description }));

function PresetChip({ preset, exists }: { preset: (typeof PRESETS)[number]; exists: boolean }) {
  const [state, action] = useFormState<AdminFormState, FormData>(createAwardAction, {});
  const done = exists || state.ok === true;
  const Chip = () => {
    const { pending } = useFormStatus();
    return (
      <button
        type="submit"
        disabled={pending || done}
        title={done ? 'Already created' : preset.description}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 14px',
          background: done ? rgba(T.win, 0.12) : 'rgba(255,255,255,0.05)',
          border: `1px solid ${done ? rgba(T.win, 0.4) : 'rgba(255,255,255,0.14)'}`,
          borderRadius: 999,
          color: done ? T.win : T.text,
          fontFamily: FONT_B,
          fontSize: 13,
          cursor: pending || done ? 'default' : 'pointer',
          opacity: pending ? 0.6 : 1,
        }}
      >
        <span>{preset.icon}</span>
        {done ? `${preset.name} ✓` : preset.name}
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

export default function AwardPresets({ existingNames = [] }: { existingNames?: string[] }) {
  const existing = new Set(existingNames.map(n => n.toLowerCase()));
  const missing = PRESETS.filter(p => !existing.has(p.name.toLowerCase()));

  // All classics created — the section has done its job, get out of the way.
  if (missing.length === 0) return null;

  return (
    <div style={{ ...glass({ padding: 18 }), marginBottom: 20 }}>
      <div style={{ fontFamily: FONT_D, fontSize: 13, letterSpacing: 1.5, color: ADMIN_ACCENT, marginBottom: 4 }}>
        QUICK ADD — LEAGUE CLASSICS
      </div>
      <p style={{ fontFamily: FONT_B, fontSize: 12.5, color: T.faint, margin: '0 0 12px' }}>
        Tap to create the base honours. Per-edition awards (e.g. “Blaze&apos;s Boot XV”) are minted
        automatically by each tournament&apos;s 🏆 Ceremony page.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PRESETS.map(p => (
          <PresetChip key={p.name} preset={p} exists={existing.has(p.name.toLowerCase())} />
        ))}
      </div>
    </div>
  );
}
