'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FONT_B, T, rgba } from '@/lib/realm-colors';
import HueWheel from '@/components/ui/HueWheel';
import { saveOwnFlair } from '@/app/settings/actions';

// Inline editing on your own profile: a pen next to your quote, a palette for
// your accent colour — change, save, done. No trip to Settings needed.

const penStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: T.faint,
  fontSize: 13,
  padding: '2px 4px',
  lineHeight: 1,
};

export function QuoteEditor({ quote, accent }: { quote: string | null; accent: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(quote ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const err = await saveOwnFlair({ quote: value });
      if (err) { setError(err); return; }
      setError(null);
      setEditing(false);
      router.refresh();
    });
  };

  if (!editing) {
    return quote ? (
      <div style={{
        marginTop: 18, padding: '14px 18px',
        background: 'rgba(255,255,255,0.035)',
        borderLeft: `2px solid ${accent}`, borderRadius: 10,
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <span style={{ color: T.text, fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 16, flex: 1 }}>
          &ldquo;{quote}&rdquo;
        </span>
        <button type="button" onClick={() => { setValue(quote); setEditing(true); }} title="Edit quote" style={penStyle}>
          ✎
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          marginTop: 16,
          background: 'none',
          border: `1px dashed ${rgba(accent, 0.4)}`,
          borderRadius: 10,
          padding: '9px 14px',
          color: T.dim,
          fontFamily: FONT_B,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        ＋ Add a quote
      </button>
    );
  }

  return (
    <div style={{
      marginTop: 18, padding: '12px 14px',
      background: 'rgba(255,255,255,0.035)',
      borderLeft: `2px solid ${accent}`, borderRadius: 10,
    }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        maxLength={100}
        autoFocus
        placeholder="A short quote…"
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8,
          padding: '8px 11px',
          color: T.text,
          fontFamily: FONT_B,
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          style={{
            background: accent, border: 'none', borderRadius: 8,
            padding: '6px 16px', color: '#fff', fontFamily: FONT_B, fontWeight: 700,
            fontSize: 12.5, cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => { setEditing(false); setError(null); }} style={{ ...penStyle, fontSize: 12.5, fontFamily: FONT_B }}>
          Cancel
        </button>
        {error && <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 12 }}>{error}</span>}
      </div>
    </div>
  );
}

export function AccentEditor({ accentColor }: { accentColor: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (form: HTMLFormElement) => {
    const value = String(new FormData(form).get('accentColor') ?? '');
    startTransition(async () => {
      const err = await saveOwnFlair({ accentColor: value });
      if (err) { setError(err); return; }
      setError(null);
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Change your accent colour"
        style={{ ...penStyle, fontSize: 15 }}
      >
        🎨
      </button>
    );
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); save(e.currentTarget); }}
      style={{
        marginTop: 12,
        padding: 14,
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14,
      }}
    >
      <HueWheel name="accentColor" defaultValue={accentColor} size={110} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8, padding: '6px 16px', color: T.text,
            fontFamily: FONT_B, fontWeight: 700, fontSize: 12.5,
            cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? 'Saving…' : 'Save colour'}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ ...penStyle, fontSize: 12.5, fontFamily: FONT_B }}>
          Cancel
        </button>
        {error && <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 12 }}>{error}</span>}
      </div>
    </form>
  );
}
