import { rgba } from '../realm-colors';

export type Bolt  = { pts: [number, number][]; branches: [number, number][][]; life: number };
export type Ember = { x: number; y: number; vy: number; vx: number; r: number; a: number; ph: number };
export type Rain  = { x: number; y: number; len: number; sp: number; a: number };
export type Shock = { x: number; y: number; r: number; life: number };
export type Flash = { a: number; c: string };

export function spawnEmber(W: number, H: number): Ember {
  return {
    x:  Math.random() * W,
    y:  H + Math.random() * H,
    vy: 0.3 + Math.random() * 0.9,
    vx: (Math.random() - 0.5) * 0.3,
    r:  0.6 + Math.random() * 1.8,
    a:  0.1 + Math.random() * 0.5,
    ph: Math.random() * 6.28,
  };
}

export function spawnRain(W: number, H: number): Rain {
  return {
    x:   Math.random() * W,
    y:   Math.random() * H,
    len: 12 + Math.random() * 26,
    sp:  7  + Math.random() * 9,
    a:   0.04 + Math.random() * 0.1,
  };
}

export function makeBolt(W: number, H: number): Bolt {
  const x0 = W * (0.18 + Math.random() * 0.64);
  const pts: [number, number][] = [[x0, 0]];
  let x = x0, y = 0;
  const segs = 17 + Math.floor(Math.random() * 8);
  const step = H / segs;

  for (let i = 0; i < segs; i++) {
    y += step * (0.7 + Math.random() * 0.6);
    x += (Math.random() - 0.5) * W * 0.075;
    pts.push([x, y]);
  }

  const branches: [number, number][][] = [];
  for (let i = 4; i < pts.length - 2; i++) {
    if (Math.random() < 0.2) {
      let bx = pts[i][0], by = pts[i][1];
      const bp: [number, number][] = [[bx, by]];
      const n = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < n; j++) {
        bx += (Math.random() - 0.3) * W * 0.07;
        by += step * 0.85;
        bp.push([bx, by]);
      }
      branches.push(bp);
    }
  }
  return { pts, branches, life: 1 };
}

function poly(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  w: number,
  color: string,
  alpha: number,
): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 20;
  ctx.shadowColor = color;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

export function drawFx(
  cv: HTMLCanvasElement | null,
  now: number,
  accentHex: string,
  bolts: Bolt[],
  embers: Ember[],
  rain: Rain[],
  shocks: Shock[],
  flash: Flash,
  reduced: boolean,
  energy: number,
): void {
  if (!cv) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  if (!reduced) {
    ctx.strokeStyle = rgba(accentHex, 0.5);
    ctx.lineWidth = 1;
    for (const d of rain) {
      d.y += d.sp; d.x += d.sp * 0.18;
      if (d.y > H) { d.y = -d.len; d.x = Math.random() * W; }
      ctx.globalAlpha = d.a;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.18, d.y - d.len);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      e.y -= e.vy * (1 + energy);
      e.x += e.vx + Math.sin(now / 900 + e.ph) * 0.25;
      if (e.y < -10) { e.y = H + 10; e.x = Math.random() * W; }
      const tw = 0.6 + Math.sin(now / 500 + e.ph) * 0.4;
      ctx.globalAlpha = e.a * tw * (0.7 + energy * 0.6);
      ctx.fillStyle = accentHex;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  if (flash.a > 0.01) {
    ctx.globalAlpha = flash.a * 0.2;
    ctx.fillStyle = flash.c;
    ctx.fillRect(0, 0, W, H);
    flash.a *= 0.86;
    ctx.globalAlpha = 1;
  }

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = shocks.length - 1; i >= 0; i--) {
    const s = shocks[i];
    s.r += W * 0.012;
    s.life -= 0.04;
    if (s.life <= 0) { shocks.splice(i, 1); continue; }
    ctx.globalAlpha = s.life * 0.5;
    ctx.lineWidth = 2 * s.life;
    ctx.strokeStyle = accentHex;
    ctx.shadowBlur = 16;
    ctx.shadowColor = accentHex;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, 6.2832);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i], a = b.life;
    poly(ctx, b.pts, 8, accentHex, a * 0.18);
    poly(ctx, b.pts, 2.2, '#FFFFFF', a * 0.95);
    for (const br of b.branches) poly(ctx, br, 1.4, accentHex, a * 0.5);
    b.life -= 0.048;
    if (b.life <= 0) bolts.splice(i, 1);
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
