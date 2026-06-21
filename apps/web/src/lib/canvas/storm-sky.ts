import type { RealmResult } from '../realm-colors';
import { rgba } from '../realm-colors';

type Blob = { x: number; y: number; fx: number; fy: number; rx: number; a: number };

export const BLOBS: Blob[] = [
  { x: 0.3,  y: 0.3,  fx: 0.00007, fy: 0.00005, rx: 0.55, a: 0.5  },
  { x: 0.7,  y: 0.25, fx: 0.00009, fy: 0.00006, rx: 0.5,  a: 0.42 },
  { x: 0.5,  y: 0.55, fx: 0.00006, fy: 0.00008, rx: 0.6,  a: 0.4  },
  { x: 0.2,  y: 0.7,  fx: 0.0001,  fy: 0.00005, rx: 0.45, a: 0.32 },
  { x: 0.82, y: 0.65, fx: 0.00008, fy: 0.00009, rx: 0.5,  a: 0.34 },
];

export function drawSky(
  cv: HTMLCanvasElement | null,
  now: number,
  r: RealmResult,
  energy: number,
): void {
  if (!cv) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const W = cv.width, H = cv.height;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, r.top);
  g.addColorStop(1, r.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'lighter';
  for (const b of BLOBS) {
    const cx = (b.x + Math.sin(now * b.fx) * 0.12) * W;
    const cy = (b.y + Math.cos(now * b.fy) * 0.12) * H;
    const rad = b.rx * W * (0.9 + energy * 0.25);
    const col = b.a > 0.4 ? r.accent : r.accent2;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    rg.addColorStop(0, rgba(col, (b.a * (0.5 + energy * 0.5)).toFixed(3)));
    rg.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, 6.2832);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
