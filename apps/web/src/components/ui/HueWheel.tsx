'use client';
import { useEffect, useRef, useState } from 'react';
import { FONT_B, FONT_M, T } from '@/lib/realm-colors';

// Accent-colour picker: a draggable hue wheel instead of a hex box.
// Picks HUE only — saturation/lightness are fixed at values that always read
// well on the dark theme (no black/grey/blinding-white accents possible).
// The chosen #rrggbb lives in a hidden input (name=…); empty = "use default"
// (the server maps '' → null). Responds to the owning form's reset event.

const SAT = 0.85;
const LIGHT = 0.55;

export function hueToHex(hue: number): string {
  const h = ((hue % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * LIGHT - 1)) * SAT;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = LIGHT - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Approximate hue of an existing #rrggbb (so the knob starts where the saved colour is). */
export function hexToHue(hex: string): number | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0; // grey — no hue
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

type Props = {
  name: string;
  defaultValue: string | null;
  size?: number;
};

export default function HueWheel({ name, defaultValue, size = 132 }: Props) {
  const initialHue = defaultValue ? hexToHue(defaultValue) : null;
  const [hue, setHue] = useState<number | null>(initialHue);
  const wheelRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);

  const value = hue === null ? '' : hueToHex(hue);
  const ring = 18;
  const knobRadius = size / 2 - ring / 2;
  // 0° at 12 o'clock, clockwise — matches conic-gradient(from 0deg).
  const knobAngle = ((hue ?? 0) - 90) * (Math.PI / 180);

  const hueFromPointer = (e: PointerEvent | React.PointerEvent) => {
    const rect = wheelRef.current!.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI; // 0° at 3 o'clock
    return (deg + 90 + 360) % 360;                    // → 0° at 12 o'clock
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setHue(hueFromPointer(e));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current) setHue(hueFromPointer(e));
  };
  const onPointerUp = () => { dragging.current = false; };

  // Restore the saved value when the owning form is reset.
  useEffect(() => {
    const form = hiddenRef.current?.form;
    if (!form) return;
    const onReset = () => setHue(initialHue);
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <input ref={hiddenRef} type="hidden" name={name} value={value} />

      <div
        ref={wheelRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          cursor: 'pointer',
          touchAction: 'none',
          flexShrink: 0,
          background: 'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
          // Punch the middle out so it reads as a ring.
          WebkitMask: `radial-gradient(circle, transparent ${size / 2 - ring}px, #000 ${size / 2 - ring + 1}px)`,
          mask: `radial-gradient(circle, transparent ${size / 2 - ring}px, #000 ${size / 2 - ring + 1}px)`,
        }}
      >
        {hue !== null && (
          <div style={{
            position: 'absolute',
            left: size / 2 + knobRadius * Math.cos(knobAngle) - 9,
            top: size / 2 + knobRadius * Math.sin(knobAngle) - 9,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: value,
            border: '2.5px solid #fff',
            boxShadow: '0 0 8px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: hue !== null ? value : 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            flexShrink: 0,
          }} />
          <span style={{ fontFamily: FONT_M, fontSize: 12, color: hue !== null ? T.text : T.faint }}>
            {hue !== null ? value : 'default'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setHue(null)}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 8,
            padding: '5px 12px',
            color: T.dim,
            fontFamily: FONT_B,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Use default
        </button>
      </div>
    </div>
  );
}
