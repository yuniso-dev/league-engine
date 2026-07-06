'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FrontierStatBoards, PublicPlayer, PublicTournament, VoiceNowEntry } from '@inazuma/db';
import { FrontierPage } from './FrontierPage';
import { RankingsPage } from './RankingsPage';
import { ProfilePage } from './ProfilePage';
import { CasualPage } from './CasualPage';
import { AccountMenu } from './AccountMenu';
import { Bolt } from './ui/Bolt';
import {
  REALMS, T, FONT_D, FONT_B, FONT_M,
  clamp, rgba, lighten, realmAt, glass,
} from '@/lib/realm-colors';

type Props = {
  rankings: PublicPlayer[];
  tournaments: PublicTournament[];
  voice: VoiceNowEntry[];
  season?: number;
  placementGames?: number;
  liveStats?: FrontierStatBoards;
  allTimeStats?: FrontierStatBoards;
  statsPreview?: boolean;
  dataOffline?: boolean;
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

// All pane geometry derives from the realm count — adding a realm to REALMS
// is all it takes for the track, pill and dots to follow.
const N = REALMS.length;
const LAST = N - 1;
const PANE = 100 / N;

export default function StormShell({ rankings, tournaments, voice, season, placementGames, liveStats, allTimeStats, statsPreview, dataOffline, isLoggedIn, isAdmin, currentUser }: Props) {
  const [index,  setIndex]  = useState(1);  // 0=Frontier, 1=Rankings, 2=Profile, 3=Casual
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
    const idx = clamp(i, 0, LAST);
    target.current = idx;
    setIndex(idx);
  };

  const openPlayer = (p: PublicPlayer) => {
    setViewed(p);
    animTo(2);
  };

  // Keep the viewed profile in sync with fresh server data. router.refresh()
  // (e.g. after saving your accent/quote) re-renders us with a new currentUser,
  // but useState's initial value is sticky — without this the profile keeps
  // showing the pre-save colour. Only re-sync when we're looking at ourselves
  // (or nothing yet), so browsing another player isn't yanked back.
  useEffect(() => {
    setViewed(prev =>
      currentUser && (prev === null || prev.publicId === currentUser.publicId)
        ? currentUser
        : prev,
    );
  }, [currentUser]);

  // ── self-healing data ─────────────────────────────────────────────────────────
  // A cold serverless start or a database blip can miss the render window and
  // trip the "reconnecting" banner. It usually clears in seconds — so while the
  // banner is up, quietly re-fetch the server data every few seconds (soft
  // refresh: no reload, no lost scroll/tab state) instead of waiting for the
  // user to mash Refresh. Capped so a real outage doesn't hammer the server.
  const router = useRouter();
  const retries = useRef(0);
  useEffect(() => {
    if (!dataOffline) {
      retries.current = 0;
      return;
    }
    const id = setInterval(() => {
      if (retries.current >= 5) {
        clearInterval(id);
        return;
      }
      retries.current += 1;
      router.refresh();
    }, 6000);
    return () => clearInterval(id);
  }, [dataOffline, router]);

  // ── swipe spring + pill rAF ───────────────────────────────────────────────────
  useEffect(() => {
    let raf: number;
    const frame = () => {
      const W = wrapRef.current ? wrapRef.current.clientWidth : 1;
      const d = drag.current;

      if (d.on && d.lock === 'h') {
        offset.current = clamp(d.base - d.dx / W, 0, LAST);
      } else {
        offset.current += (target.current - offset.current) * 0.15;
        if (Math.abs(target.current - offset.current) < 0.0004) offset.current = target.current;
      }

      const f = offset.current;
      const r = realmAt(f);

      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${-f * PANE}%,0,0)`;
      }
      if (pillRef.current) {
        pillRef.current.style.left       = `calc(${(f / N) * 100}% + 5px)`;
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
      animTo(clamp(tgt, 0, LAST));
    }
    d.on = false; d.lock = null;
  };

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={wrapRef}
      style={{
        height: '100vh', overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: FONT_B,
        background: 'linear-gradient(160deg, #09091f 0%, #04050c 55%, #0a0412 100%)',
      }}
    >
      {/* subtle vignette */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', background: 'radial-gradient(125% 80% at 50% 0%, transparent 52%, rgba(0,0,0,0.5) 100%)' }} />

      {/* ── header + tab bar ── */}
      <div style={{ position: 'relative', zIndex: 10, flexShrink: 0, padding: '16px 16px 12px' }}>
        {dataOffline && (
          <div style={{
            ...glass({ padding: '8px 12px', borderRadius: 10 }),
            marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap',
            border: `1px solid ${rgba('#FFD24A', 0.35)}`,
          }}>
            <span style={{ fontFamily: FONT_B, fontSize: 12, color: T.dim }}>
              ⚡ Live data is reconnecting — retrying automatically…
            </span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                fontFamily: FONT_B, fontSize: 12, fontWeight: 700,
                color: '#04060D', background: '#FFD24A',
                border: 'none', borderRadius: 7, padding: '4px 12px', cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
          <Bolt size={18} color={T.gold} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
            <span style={{ fontFamily: FONT_D, color: T.text, fontSize: 22, letterSpacing: 3 }}>
              INAZUMA <span style={{ color: T.gold }}>FC</span>
            </span>
            <span style={{
              fontFamily: FONT_M, fontSize: 8.5, letterSpacing: 3,
              color: process.env.NEXT_PUBLIC_TEST_MODE === 'true' ? '#FF9B3D' : rgba(T.gold, 0.85),
              marginTop: 3,
            }}>
              {/* NEXT_PUBLIC_TEST_MODE=true marks a rehearsal deployment so
                  nobody mistakes the dress run for the real launch. */}
              {process.env.NEXT_PUBLIC_TEST_MODE === 'true' ? '⚠ TEST SEASON' : `SEASON ${season ?? 1}`}
            </span>
          </div>
          {/* the guide — mirrors the account menu on the other side */}
          <div style={{ position: 'absolute', left: 0 }}>
            <Link
              href="/guide"
              className="tap"
              title="How it works"
              aria-label="How it works"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)',
                color: T.dim, textDecoration: 'none',
                fontFamily: FONT_D, fontSize: 15,
              }}
            >
              ?
            </Link>
          </div>
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
              width: `calc(${PANE}% - 6px)`,
              left: `calc(${PANE}% + 5px)`,
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
          position: 'relative', flex: 1, minHeight: 0,
          overflow: 'hidden', touchAction: 'pan-y', zIndex: 5,
        }}
      >
        <div
          ref={trackRef}
          style={{
            display: 'flex', width: `${N * 100}%`, height: '100%',
            transform: `translate3d(${-PANE}%,0,0)`,
            willChange: 'transform',
          }}
        >
          <div className="ina-scroll" style={{ width: `${PANE}%`, height: '100%', overflowY: 'auto', touchAction: 'pan-y' }}>
            <FrontierPage
              tournaments={tournaments}
              voice={voice}
              liveStats={liveStats}
              allTimeStats={allTimeStats}
              statsPreview={statsPreview}
              season={season}
            />
          </div>
          <div className="ina-scroll" style={{ width: `${PANE}%`, height: '100%', overflowY: 'auto', touchAction: 'pan-y' }}>
            <RankingsPage players={rankings} onOpen={openPlayer} season={season} />
          </div>
          <div className="ina-scroll" style={{ width: `${PANE}%`, height: '100%', overflowY: 'auto', touchAction: 'pan-y' }}>
            <ProfilePage
              player={viewed}
              isOwn={viewed !== null && currentUser !== null && viewed.publicId === currentUser.publicId}
              isLoggedIn={isLoggedIn}
              currentUser={currentUser}
              placementGames={placementGames}
            />
          </div>
          <div className="ina-scroll" style={{ width: `${PANE}%`, height: '100%', overflowY: 'auto', touchAction: 'pan-y' }}>
            <CasualPage active={index === 3} mePublicId={currentUser?.publicId ?? null} />
          </div>
        </div>
      </div>

      {/* nav dots — lifted above the iOS home indicator */}
      <div style={{ position: 'absolute', bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8, zIndex: 10 }}>
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
