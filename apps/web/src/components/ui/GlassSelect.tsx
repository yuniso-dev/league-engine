'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FONT_B, T, glass } from '@/lib/realm-colors';

// Themed replacement for native <select> — a glass panel instead of the
// white OS dropdown. Form-friendly: the chosen value lives in a hidden input
// (name=…), works uncontrolled (defaultValue) or controlled (value+onChange),
// and listens for the owning form's reset event so formRef.current?.reset()
// restores the default (the award forms rely on that).

export type GlassSelectOption = {
  value: string;
  label: string;
  /** Optional leading visual (e.g. a <FlagIcon/>), shown in the list and on the trigger. */
  icon?: React.ReactNode;
};

type Props = {
  name?: string;
  options: GlassSelectOption[];
  defaultValue?: string;
  value?: string;                       // controlled mode
  onChange?: (value: string) => void;
  placeholder?: string;                 // label when nothing is selected
  searchable?: boolean;                 // filter box inside the panel (long lists)
  accent?: string;                      // highlight colour
  required?: boolean;
  style?: React.CSSProperties;          // merged onto the trigger button
};

const triggerBase: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  padding: '10px 14px',
  color: T.text,
  fontFamily: FONT_B,
  fontSize: 15,
  outline: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  boxSizing: 'border-box',
};

export default function GlassSelect({
  name,
  options,
  defaultValue = '',
  value,
  onChange,
  placeholder = '— None —',
  searchable = false,
  accent = '#3D8BFF',
  required = false,
  style,
}: Props) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const current = controlled ? value : inner;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusIdx, setFocusIdx] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === current) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const pick = (v: string) => {
    if (!controlled) setInner(v);
    onChange?.(v);
    setOpen(false);
    setQuery('');
  };

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Restore the default when the owning form is reset (award forms do this).
  useEffect(() => {
    const form = hiddenRef.current?.form;
    if (!form) return;
    const onReset = () => {
      if (!controlled) setInner(defaultValue);
      onChange?.(defaultValue);
    };
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled, defaultValue]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setOpen(true);
      setFocusIdx(Math.max(0, filtered.findIndex(o => o.value === current)));
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx(i => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[focusIdx];
      if (opt) pick(opt.value);
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }} onKeyDown={onKeyDown}>
      {name && (
        <input
          ref={hiddenRef}
          type="hidden"
          name={name}
          value={current}
          required={required}
        />
      )}

      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ ...triggerBase, ...style }}
      >
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          overflow: 'hidden',
          color: selected ? T.text : T.faint,
        }}>
          {selected?.icon}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <span aria-hidden style={{
          color: T.faint,
          fontSize: 10,
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s',
          flexShrink: 0,
        }}>
          ▼
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            ...glass({ padding: 6, borderRadius: 12 }),
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 50,
            maxHeight: 260,
            overflowY: 'auto',
            // Solid-ish backdrop so options stay readable over page content.
            background: 'rgba(14,18,34,0.96)',
          }}
        >
          {searchable && (
            <input
              autoFocus
              value={query}
              onChange={e => { setQuery(e.target.value); setFocusIdx(0); }}
              placeholder="Search…"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '8px 10px',
                color: T.text,
                fontFamily: FONT_B,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: 4,
              }}
            />
          )}

          {filtered.length === 0 ? (
            <div style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, padding: '9px 10px' }}>
              No matches.
            </div>
          ) : (
            filtered.map((o, i) => {
              const isSelected = o.value === current;
              const isFocused = i === focusIdx;
              return (
                <button
                  key={o.value || '__none__'}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => pick(o.value)}
                  onMouseEnter={() => setFocusIdx(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 10px',
                    background: isSelected
                      ? `${accent}26`
                      : isFocused
                        ? 'rgba(255,255,255,0.07)'
                        : 'none',
                    border: 'none',
                    borderRadius: 8,
                    color: o.value === '' ? T.dim : T.text,
                    fontFamily: FONT_B,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  {o.icon}
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {o.label}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
