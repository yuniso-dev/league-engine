'use client';
import { useState, useRef, useEffect } from 'react';
import type { PublicPlayer, PublicTournament } from '@inazuma/db';
import { FrontierPage } from './FrontierPage';
import { RankingsPage } from './RankingsPage';
import { ProfilePage } from './ProfilePage';
import { Bolt } from './ui/Bolt';
import {
  REALMS, T, FONT_D, FONT_B, FONT_M,
  clamp, lerp, rgba, lighten, realmAt, glass,
} from '@/lib/realm-colors';
import { drawSky } from '@/lib/canvas/storm-sky';
import { drawFx, makeBolt, spawnEmber, spawnRain } from '@/lib/canvas/storm-fx';
import type { Bolt as BoltShape, Ember, Rain, Shock, Flash } from '@/lib/canvas/storm-fx';

type Props = {
  rankings: PublicPlayer[];
  tournaments: PublicTournament[];
};

type DragState = {
  on: boolean;
  lock: 'h' | 'v' | null;
  sx: number; sy: number;
  base: number; dx: number;
  lastX: number; lastT: number;
  vel: number;
};

export default function StormShell({ rankings, tournaments }: Props) {
  const [index,  setIndex]  = useState(1);  // 0=Frontier, 1=Rankings, 2=Profile
  const [viewed, setViewed] = useState<PublicPlayer | null>(null);
  const [intro,  setIntro]  = useState(true);

  // ── DOM refs ──────────────────────────────────────────────────────────────────
  const wrapRef  = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const skyRef   = useRef<HTMLCanvasElement>(null);
  const fxRef    = useRef<HTMLCanvasElement>(null);
  const pillRef  = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);

  // ── animation state (mutated in rAF, never causes re-render) ─────────────────
  const offset  = useRef(1);
  const target  = useRef(1);
  const prevF   = useRef(1);
  const energy  = useRef(0);

  // ── particle arrays ───────────────────────────────────────────────────────────
  const bolts  = useRef<BoltShape[]>([]);
  const embers = useRef<Ember[]>([]);
  const rain   = useRef<Rain[]>([]);
  const shocks = useRef<Shock[]>([]);
  const flash  = useRef<Flash>({ a: 0, c: REALMS[1].accent });

  // ── device feature flags ──────────────────────────────────────────────────────
  const reduced     = useRef(false);
  const finePointer = useRef(false);

  // ── swipe drag state ──────────────────────────────────────────────────────────
  const drag = useRef<DragState>({
    on: false, lock: null,
    sx: 0, sy: 0, base: 1, dx: 0,
    lastX: 0, lastT: 0, vel: 0,
  });

  // ── helpers ───────────────────────────────────────────────────────────────────

  const strike = (accentHex: string, big = false) => {
    const cv = fxRef.current;
    if (!cv) return;
    const b = makeBolt(cv.width, cv.height);
    bolts.current.push(b);
    if (big || Math.random() < 0.4) bolts.current.push(makeBolt(cv.width, cv.height));
    shocks.current.push({ x: b.pts[0][0], y: b.pts[0][1], r: 0, life: 1 });
    flash.current = { a: reduced.current ? 0.22 : (big ? 0.7 : 0.5), c: accentHex };
  };

  const animTo = (i: number, doStrike = true) => {
    const idx = clamp(i, 0, 2);
    target.current = idx;
    setIndex(idx);
    if (doStrike) strike(REALMS[idx].accent);
  };

  const openPlayer = (p: PublicPlayer) => {
    setViewed(p);
    animTo(2);
  };

  // ── setup: canvas sizing + media queries ──────────────────────────────────────
  useEffect(() => {
    reduced.current     = !!(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    finePointer.current = !!(window.matchMedia?.('(pointer: fine)').matches);

    const resize = () => {
      const wrap = wrapRef.current, sky = skyRef.current, fx = fxRef.current;
      if (!wrap || !sky || !fx) return;
      const cw = wrap.clientWidth, ch = wrap.clientHeight;

      sky.width  = Math.max(2, Math.floor(cw * 0.4));
      sky.height = Math.max(2, Math.floor(ch * 0.4));

      const dpr  = Math.min(window.devicePixelRatio || 1, 1.5);
      fx.width   = cw * dpr;
      fx.height  = ch * dpr;

      embers.current = Array.from({ length: reduced.current ? 0 : 50 }, () => spawnEmber(fx.width, fx.height));
      rain.current   = Array.from({ length: reduced.current ? 0 : 90 }, () => spawnRain(fx.width, fx.height));
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ── intro cinematic ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (reduced.current) { setIntro(false); return; }
    const t1 = setTimeout(() => strike(REALMS[1].accent, true), 340);
    const t2 = setTimeout(() => setIntro(false), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ambient lightning ─────────────────────────────────────────────────────────
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const sched = () => {
      id = setTimeout(() => {
        if (!reduced.current) strike(realmAt(offset.current).accentHex, Math.random() < 0.25);
        sched();
      }, 3600 + Math.random() * 5000);
    };
    sched();
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── main rAF loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let raf: number;
    const frame = (now: number) => {
      const W = wrapRef.current ? wrapRef.current.clientWidth : 1;
      const d = drag.current;

      if (d.on && d.lock === 'h') {
        offset.current = clamp(d.base - d.dx / W, 0, 2);
      } else {
        offset.current += (target.current - offset.current) * 0.15;
        if (Math.abs(target.current - offset.current) < 0.0004) offset.current = target.current;
      }

      const f = offset.current;
      const r = realmAt(f);
      const spd = Math.abs(f - prevF.current);
      prevF.current = f;
      energy.current = clamp(lerp(energy.current, clamp(spd * 16, 0, 1), 0.3), 0, 1);

      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${-f * 33.3333}%,0,0)`;
      }
      if (pillRef.current) {
        pillRef.current.style.left       = `calc(${(f / 3) * 100}% + 5px)`;
        pillRef.current.style.background = `linear-gradient(120deg,${r.accent},${lighten(r.accent, 0.5)})`;
        pillRef.current.style.boxShadow  = `0 0 ${20 + energy.current * 30}px ${rgba(r.accentHex, 0.55 + energy.current * 0.4)}`;
      }
      if (flashRef.current) {
        flashRef.current.style.opacity = String(clamp(flash.current.a * 0.45, 0, 0.45));
      }

      drawSky(skyRef.current, now, r, energy.current);
      drawFx(fxRef.current, now, r.accentHex, bolts.current, embers.current, rain.current, shocks.current, flash.current, reduced.current, energy.current);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── pointer handlers ──────────────────────────────────────────────────────────
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    d.on = true; d.lock = null;
    d.sx = e.clientX; d.sy = e.clientY;
    d.base = offset.current; d.dx = 0;
    d.lastX = e.clientX; d.lastT = performance.now(); d.vel = 0;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (finePointer.current && lightRef.current) {
      lightRef.current.style.left    = e.clientX + 'px';
      lightRef.current.style.top     = e.clientY + 'px';
      lightRef.current.style.opacity = '1';
    }
    const d = drag.current;
    if (!d.on) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.lock && (Math.abs(dx) > 7 || Math.abs(dy) > 7)) {
      d.lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    if (d.lock === 'h') {
      if (e.cancelable) e.preventDefault();
      d.dx = dx;
      const t = performance.now();
      d.vel = (e.clientX - d.lastX) / (t - d.lastT + 1);
      d.lastX = e.clientX; d.lastT = t;
    }
  };

  const onUp = () => {
    const d = drag.current;
    if (d.lock === 'h') {
      const o = offset.current;
      let tgt = Math.round(o);
      if (d.vel < -0.4)     tgt = Math.ceil(o);
      else if (d.vel > 0.4) tgt = Math.floor(o);
      animTo(clamp(tgt, 0, 2));
    }
    d.on = false; d.lock = null;
  };

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={wrapRef}
      style={{ height: '100vh', overflow: 'hidden', position: 'relative', fontFamily: FONT_B, background: '#04050c' }}
    >
      {/* storm sky (40% res, upscaled = intentional soft blur) */}
      <canvas ref={skyRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }} />
      {/* effects canvas: embers, rain, bolts, shocks */}
      <canvas ref={fxRef}  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }} />
      {/* vignette overlay */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', background: 'radial-gradient(125% 80% at 50% 0%, transparent 52%, rgba(0,0,0,0.6) 100%)' }} />

      {/* ── header + tab bar ── */}
      <div style={{ position: 'relative', zIndex: 10, padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
          <Bolt size={18} color={T.gold} />
          <span style={{ fontFamily: FONT_D, color: T.text, fontSize: 22, letterSpacing: 3 }}>
            INAZUMA <span style={{ color: T.gold }}>FC</span>
          </span>
        </div>

        <div style={{ position: 'relative', display: 'flex', maxWidth: 460, margin: '0 auto', ...glass({ padding: 5, borderRadius: 16 }) }}>
          {/* animated pill */}
          <div
            ref={pillRef}
            style={{
              position: 'absolute', top: 5, bottom: 5,
              width: 'calc(33.3333% - 6px)',
              left: 'calc(33.3333% + 5px)',  // matches initial index=1 (Rankings)
              borderRadius: 12, overflow: 'hidden', zIndex: 0,
            }}
          >
            <div style={{
              position: 'absolute', inset: 0, width: '40%',
              background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)',
              animation: 'pillShine 3.2s ease-in-out infinite',
            }} />
          </div>

          {REALMS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => animTo(i)}
              style={{
                flex: 1, position: 'relative', zIndex: 1,
                border: 'none', background: 'transparent',
                padding: '11px 4px', cursor: 'pointer',
                color: index === i ? '#fff' : T.dim,
                fontFamily: FONT_B, fontWeight: 700, fontSize: 13,
                letterSpacing: '0.03em', transition: 'color 0.3s',
                textShadow: index === i ? '0 1px 8px rgba(0,0,0,0.5)' : 'none',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── swipe track ── */}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          position: 'absolute', top: 102, left: 0, right: 0, bottom: 0,
          overflow: 'hidden', touchAction: 'pan-y', zIndex: 5,
        }}
      >
        <div
          ref={trackRef}
          style={{
            display: 'flex', width: '300%', height: '100%',
            transform: 'translate3d(-33.3333%,0,0)',  // initial: Rankings
            willChange: 'transform',
          }}
        >
          <div className="ina-scroll" style={{ width: '33.3333%', height: '100%', overflowY: 'auto', touchAction: 'pan-y' }}>
            <FrontierPage tournaments={tournaments} />
          </div>
          <div className="ina-scroll" style={{ width: '33.3333%', height: '100%', overflowY: 'auto', touchAction: 'pan-y' }}>
            <RankingsPage players={rankings} onOpen={openPlayer} />
          </div>
          <div className="ina-scroll" style={{ width: '33.3333%', height: '100%', overflowY: 'auto', touchAction: 'pan-y' }}>
            <ProfilePage player={viewed} />
          </div>
        </div>
      </div>

      {/* screen flash (lightning hit) */}
      <div
        ref={flashRef}
        style={{ position: 'absolute', inset: 0, zIndex: 8, pointerEvents: 'none', background: '#fff', opacity: 0, mixBlendMode: 'overlay' }}
      />

      {/* pointer light halo — desktop fine-pointer only */}
      <div
        ref={lightRef}
        style={{
          position: 'absolute', width: 420, height: 420, borderRadius: '50%',
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(circle,rgba(255,255,255,0.1),transparent 65%)',
          pointerEvents: 'none', zIndex: 6, opacity: 0,
          mixBlendMode: 'screen', transition: 'opacity 0.4s',
        }}
      />

      {/* nav dots */}
      <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8, zIndex: 10 }}>
        {REALMS.map((s, i) => (
          <button
            key={i}
            onClick={() => animTo(i)}
            style={{
              width: i === index ? 26 : 7, height: 7, borderRadius: 4,
              border: 'none', padding: 0, cursor: 'pointer',
              background: i === index ? s.accent : 'rgba(255,255,255,0.28)',
              boxShadow: i === index ? `0 0 12px ${s.accent}` : 'none',
              transition: 'all 0.35s',
            }}
          />
        ))}
      </div>

      {/* cinematic intro overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: '#04050c',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: intro ? 1 : 0,
        pointerEvents: intro ? 'auto' : 'none',
        transition: 'opacity 0.9s ease 0.2s',
      }}>
        <div style={{ textAlign: 'center', animation: 'introTitle 1.3s cubic-bezier(0.2,0.7,0.2,1) both' }}>
          <Bolt size={56} color={T.gold} style={{ filter: `drop-shadow(0 0 24px ${rgba(T.gold, 0.7)})` }} />
          <div style={{ fontFamily: FONT_D, color: T.text, fontSize: 46, letterSpacing: 4, marginTop: 10 }}>
            INAZUMA <span style={{ color: T.gold }}>FC</span>
          </div>
          <div style={{ fontFamily: FONT_M, color: T.dim, fontSize: 11, letterSpacing: 6, marginTop: 8 }}>
            FRONTIER LEAGUE
          </div>
        </div>
      </div>
    </div>
  );
}
