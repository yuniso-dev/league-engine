'use client';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { AdminPlayerDetail } from '@inazuma/db';
import { FONT_B, FONT_D, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { updatePlayerProfileAction, type AdminFormState } from '@/app/admin/actions';

type Props = { player: AdminPlayerDetail['player'] };

const captionStyle: React.CSSProperties = {
  fontFamily: FONT_B,
  fontSize: 12,
  color: T.faint,
  margin: '4px 0 0',
  lineHeight: 1.4,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '11px 22px',
        background: ADMIN_ACCENT,
        border: 'none',
        borderRadius: 10,
        color: '#fff',
        fontFamily: FONT_D,
        fontSize: 13,
        letterSpacing: 1.5,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? 'SAVING…' : 'SAVE PROFILE'}
    </button>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: FONT_B,
      fontSize: 13,
      color: T.dim,
      cursor: 'pointer',
    }}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} style={{ accentColor: ADMIN_ACCENT }} />
      {label}
    </label>
  );
}

export default function AdminPlayerProfileForm({ player }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(updatePlayerProfileAction, {});
  const [accent, setAccent] = useState(player.accentColor ?? '');
  const accentValid = /^#[0-9a-f]{6}$/i.test(accent);

  return (
    <form action={action}>
      <div style={glass({ padding: 20 })}>
        <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 14 }}>
          PROFILE FLAIR
        </div>
        <input type="hidden" name="publicId" value={player.publicId} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12 }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input
              name="title"
              maxLength={40}
              defaultValue={player.title ?? ''}
              autoComplete="off"
              placeholder="THE WALL"
              style={inputBase}
            />
            <p style={captionStyle}>Shown under the player&apos;s name on their profile.</p>
          </div>
          <div>
            <label style={labelStyle}>Accent colour</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                name="accentColor"
                value={accent}
                onChange={e => setAccent(e.target.value)}
                maxLength={7}
                autoComplete="off"
                placeholder="#ff7a1a"
                style={inputBase}
              />
              <span style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                flexShrink: 0,
                background: accentValid ? accent : 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
              }} />
            </div>
            <p style={captionStyle}>Tints their profile card. Empty = default.</p>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Character</label>
          <textarea
            name="characterNote"
            maxLength={600}
            rows={3}
            defaultValue={player.characterNote ?? ''}
            placeholder="What kind of player are they? Playstyle, temperament, signature moves…"
            style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Achievements (one per line)</label>
          <textarea
            name="achievements"
            maxLength={1000}
            rows={4}
            defaultValue={player.achievements ?? ''}
            placeholder={'Frontier I champion\nFirst player to reach 1200 Elo'}
            style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 16 }}>
          <Toggle name="showCharacter" label="Show character" defaultChecked={player.showCharacter} />
          <Toggle name="showAchievements" label="Show achievements" defaultChecked={player.showAchievements} />
          <Toggle name="showAwards" label="Show awards" defaultChecked={player.showAwards} />
        </div>
        <p style={captionStyle}>Unticked sections are hidden from everyone viewing this profile.</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
          <SubmitButton />
          {state.error && (
            <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13 }}>{state.error}</span>
          )}
          {state.ok && state.message && (
            <span style={{ fontFamily: FONT_B, color: T.win, fontSize: 13 }}>{state.message}</span>
          )}
        </div>
      </div>
    </form>
  );
}
