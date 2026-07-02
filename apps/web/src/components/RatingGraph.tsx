'use client';
import { useMemo, useRef, useState } from 'react';
import type { RatingPoint } from '@inazuma/db';
import { FONT_B, FONT_M, T } from '@/lib/realm-colors';

// Series color validated for dark surfaces (OKLCH lightness band + ≥3:1 contrast).
const SERIES = '#E06600';
// Ring/crosshair "surface" color — the dark gradient behind the glass card.
const SURFACE = '#140B06';

const W = 560;
const H = 190;
const M = { top: 16, right: 52, bottom: 26, left: 44 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// weekOf is a plain YYYY-MM-DD — format without Date to keep SSR/client output identical.
function fmtWeek(weekOf: string): string {
  const [, m, d] = weekOf.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]}`;
}

function niceTicks(min: number, max: number): number[] {
  if (min === max) { min -= 10; max += 10; }
  const span = max - min;
  const step = [5, 10, 20, 25, 50, 100, 200, 400].find(s => span / s <= 4) ?? 500;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  return ticks;
}

type Props = { points: RatingPoint[] };

export function RatingGraph({ points }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { xs, ys, ticks, path, area } = useMemo(() => {
    const elos = points.map(p => p.elo);
    const t = niceTicks(Math.min(...elos), Math.max(...elos));
    const lo = t[0];
    const hi = t[t.length - 1];
    const xAt = (i: number) => M.left + (points.length === 1 ? PW / 2 : (i / (points.length - 1)) * PW);
    const yAt = (elo: number) => M.top + PH - ((elo - lo) / (hi - lo)) * PH;
    const px = points.map((_, i) => xAt(i));
    const py = points.map(p => yAt(p.elo));
    const d = px.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${py[i].toFixed(1)}`).join(' ');
    const a = `${d} L${px[px.length - 1].toFixed(1)},${M.top + PH} L${px[0].toFixed(1)},${M.top + PH} Z`;
    return { xs: px, ys: py, ticks: t.map(v => ({ v, y: yAt(v) })), path: d, area: a };
  }, [points]);

  const pick = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < xs.length; i++) {
      if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
    }
    setHover(best);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      setHover(h => Math.max(0, Math.min(points.length - 1, (h ?? points.length - 1) + dir)));
    } else if (e.key === 'Escape') {
      setHover(null);
    }
  };

  const last = points.length - 1;
  const h = hover;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', outline: 'none', touchAction: 'pan-y' }}
        role="img"
        aria-label={`Elo rating over ${points.length} reveals, currently ${Math.round(points[last].elo)}`}
        tabIndex={0}
        onPointerMove={e => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover(hv => hv ?? last)}
        onBlur={() => setHover(null)}
        onKeyDown={onKeyDown}
      >
        {/* gridlines — hairline, recessive */}
        {ticks.map(t => (
          <g key={t.v}>
            <line
              x1={M.left} x2={M.left + PW} y1={t.y} y2={t.y}
              stroke="rgba(255,255,255,0.07)" strokeWidth={1}
            />
            <text
              x={M.left - 8} y={t.y + 3}
              textAnchor="end"
              style={{ fontFamily: FONT_M, fontSize: 10, fill: T.faint }}
            >
              {t.v}
            </text>
          </g>
        ))}

        {/* x labels — first and last week only; the tooltip carries the rest */}
        <text x={xs[0]} y={H - 8} textAnchor="start" style={{ fontFamily: FONT_M, fontSize: 10, fill: T.faint }}>
          {fmtWeek(points[0].weekOf)}
        </text>
        {points.length > 1 && (
          <text x={xs[last]} y={H - 8} textAnchor="end" style={{ fontFamily: FONT_M, fontSize: 10, fill: T.faint }}>
            {fmtWeek(points[last].weekOf)}
          </text>
        )}

        {/* area wash + line */}
        <path d={area} fill={SERIES} opacity={0.1} />
        <path d={path} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* crosshair */}
        {h != null && (
          <line
            x1={xs[h]} x2={xs[h]} y1={M.top} y2={M.top + PH}
            stroke="rgba(255,255,255,0.2)" strokeWidth={1}
          />
        )}

        {/* hovered point */}
        {h != null && h !== last && (
          <circle cx={xs[h]} cy={ys[h]} r={4.5} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
        )}

        {/* end marker + direct label (text token, not series color) */}
        <circle cx={xs[last]} cy={ys[last]} r={4.5} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
        <text
          x={xs[last] + 9} y={ys[last] + 4}
          style={{ fontFamily: FONT_M, fontSize: 11, fill: T.text, fontWeight: 700 }}
        >
          {Math.round(points[last].elo)}
        </text>
      </svg>

      {/* tooltip — value leads, date follows */}
      {h != null && (
        <div
          style={{
            position: 'absolute',
            left: `${(xs[h] / W) * 100}%`,
            top: 0,
            transform: `translate(${h > points.length / 2 ? '-105%' : '8px'}, 0)`,
            background: 'rgba(10,6,3,0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: '6px 10px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontFamily: FONT_M, fontSize: 13, color: T.text, fontWeight: 700 }}>
            {Math.round(points[h].elo)}
          </span>
          {points[h].rank != null && (
            <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.dim, marginLeft: 6 }}>
              #{points[h].rank}
            </span>
          )}
          <span style={{ fontFamily: FONT_B, fontSize: 11, color: T.faint, marginLeft: 6 }}>
            {fmtWeek(points[h].weekOf)}
          </span>
        </div>
      )}

      {/* non-hover access to every value */}
      <table style={{
        position: 'absolute', width: 1, height: 1, overflow: 'hidden',
        clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0, padding: 0, margin: -1,
      }}>
        <caption>Elo rating by week</caption>
        <thead>
          <tr><th>Week</th><th>Elo</th><th>Rank</th></tr>
        </thead>
        <tbody>
          {points.map(p => (
            <tr key={p.weekOf + p.elo}>
              <td>{p.weekOf}</td>
              <td>{Math.round(p.elo)}</td>
              <td>{p.rank ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
