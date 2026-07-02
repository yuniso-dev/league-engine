'use client';
import { useState, useRef, useEffect } from 'react';
import type { PublicPlayer, PublicTournament } from '@inazuma/db';
import { FrontierPage } from './FrontierPage';
import { RankingsPage } from './RankingsPage';
import { ProfilePage } from './ProfilePage';
import { AccountMenu } from './AccountMenu';
import { Bolt } from './ui/Bolt';
import {
  REALMS, T, FONT_D, FONT_B,
  clamp, rgba, lighten, realmAt, glass,
} from '@/lib/realm-colors';

type Props = {
  rankings: PublicPlayer[];
  tournaments: PublicTournament[];
  isLoggedIn: boolean;
  isAdmin: boolean;
  currentUser: PublicPlayer | null;
};

type DragState = {
  on: boolean;
  lock: 'h' | 'v' | null;
  sx: number; sy: number;
  base: number; dx: number;
  lastX: number; lastT: number;
  vel: number;
};

export default function StormShell({ rankings, tournaments, isLoggedIn, isAdmin, currentUser }: Props) {
  const [index,  setIndex]  = useState(1);  // 0=Frontier, 1=Rankings, 2=Profile
  const [viewed, setViewed] = useState<PublicPlayer | null>(currentUser);

  // ── DOM refs ──────────────────────────────────────────────────────────────────
  const wrapRef  = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef  = useRef<HTMLDivElement>(null);

  // ── animation state ───────────────────────────────────────────────────────────
  const offset = useRef(1);
  const target = useRef(1);

  // ── swipe drag state ──────────────────────────────────────────────────────────
  const drag = useRef<DragState>({
    on: false, lock: null,
    sx: 0, sy: 0, base: 1, dx: 0,
    lastX: 0, lastT: 0, vel: 0,
  });

  // ── helpers ───────────────────────────────────────────────────────────────────
  const animTo = (i: number) => {
    const idx = clamp(i, 0, 2);
    target.current = idx;
    setIndex(idx);
  };

  const openPlayer = (p: PublicPlayer) => {
    setViewed(p);
    animTo(2);
  };

  // ── swipe spring + pill rAF ───────────────────────────────────────────────────
  useEffect(() => {
    let raf: number;
    const frame = () => {
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

      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${-f * 33.3333}%,0,0)`;
      }
      if (pillRef.current) {
        pillRef.current.style.left       = `calc(${(f / 3) * 100}% + 5px)`;
        pillRef.current.style.background = `linear-gradient(120deg,${r.accent},${lighten(r.accent, 0.5)})`;
        pillRef.current.style.boxShadow  = `0 0 20px ${rgba(r.accentHex, 0.55)}`;
      }

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
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.on) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.lock && (Math.abs(dx) > 7 || Math.abs(dy) > 7)) {
      d.lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (d.lock === 'h') {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      }
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
      style={{
        height: '100vh', overflow: 'hidden', position: 'relative',
        fontFamily: FONT_B,
        background: 'linear-gradient(160deg, #09091f 0%, #04050c 55%, #0a0412 100%)',
      }}
    >
      {/* subtle vignette */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', background: 'radial-gradient(125% 80% at 50% 0%, transparent 52%, rgba(0,0,0,0.5) 100%)' }} />

      {/* ── header + tab bar ── */}
      <div style={{ position: 'relative', zIndex: 10, padding: '16px 16px 12px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
          <Bolt size={18} color={T.gold} />
          <span style={{ fontFamily: FONT_D, color: T.text, fontSize: 22, letterSpacing: 3 }}>
            INAZUMA <span style={{ color: T.gold }}>FC</span>
          </span>
          <div style={{ position: 'absolute', right: 0 }}>
            <AccountMenu currentUser={currentUser} isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', maxWidth: 460, margin: '0 auto', ...glass({ padding: 5, borderRadius: 16 }) }}>
          {/* animated pill */}
          <div
            ref={pillRef}
            style={{
              position: 'absolute', top: 5, bottom: 5,
              width: 'calc(33.3333% - 6px)',
              left: 'calc(33.3333% + 5px)',
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
            transform: 'translate3d(-33.3333%,0,0)',
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
            <ProfilePage
              player={viewed}
              isOwn={viewed !== null && currentUser !== null && viewed.publicId === currentUser.publicId}
              isLoggedIn={isLoggedIn}
              currentUser={currentUser}
            />
          </div>
        </div>
      </div>

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
    </div>
  );
}
