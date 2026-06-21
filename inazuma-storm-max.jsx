import { useState, useRef, useEffect, memo } from "react";

/* ───────── palette / realms ───────── */
const T = { text: "#EEF3FF", dim: "#94A3C4", faint: "#5C6A8C", win: "#3DDC97", loss: "#FF6B6B", gold: "#FFD24A" };
const REALMS = [
  { id: "frontier", label: "Frontier", top: "#04060D", bottom: "#0B3270", accent: "#3D8BFF", accent2: "#7FB4FF" },
  { id: "rankings", label: "Rankings", top: "#070611", bottom: "#281C56", accent: "#8B5CF6", accent2: "#C4A6FF" },
  { id: "profile",  label: "Profile",  top: "#120703", bottom: "#5A2708", accent: "#FF7A1A", accent2: "#FFB066" },
];
const FONT_D = "'Anton','Arial Narrow',sans-serif";
const FONT_B = "'Inter',system-ui,sans-serif";
const FONT_M = "'JetBrains Mono',monospace";

/* ───────── color math ───────── */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hx = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lerp = (a, b, t) => a + (b - a) * t;
const mixHex = (h1, h2, t) => { const a = hx(h1), b = hx(h2); return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`; };
const lighten = (h, t = 0.4) => mixHex(h, "#FFFFFF", t);
const rgba = (h, a) => { const [r, g, b] = hx(h); return `rgba(${r},${g},${b},${a})`; };
function realmAt(f) {
  const i0 = Math.floor(clamp(f, 0, 2)), i1 = Math.min(i0 + 1, 2), t = clamp(f - i0, 0, 1), A = REALMS[i0], B = REALMS[i1];
  return { top: mixHex(A.top, B.top, t), bottom: mixHex(A.bottom, B.bottom, t), accent: mixHex(A.accent, B.accent, t), accent2: mixHex(A.accent2, B.accent2, t), accentHex: t < 0.5 ? A.accent : B.accent };
}

/* ───────── icons ───────── */
const Bolt = ({ size = 20, color = T.gold, style }) => (<svg width={size} height={size * 1.4} viewBox="0 0 20 28" fill={color} style={style}><path d="M12 1L2 16h8l-2 11L20 12h-8.5L12 1z" /></svg>);

/* ───────── data ───────── */
const players = [
  { id: 1, name: "StrikerX", avatar: "SX", rank: 1, country: "🇧🇷", positions: ["ST", "SS"], wins: 24, losses: 6, goals: 87, assists: 43, premium: true, quote: "I don't miss the ones that matter.", awards: [{ icon: "👟", name: "Golden Boot" }, { icon: "🏆", name: "Champion ×2" }, { icon: "⭐", name: "MVP" }], description: "The most feared striker in the Frontier. Built his name on clinical finishing and an uncanny ability to deliver under pressure — dragging his draft team to back-to-back finals." },
  { id: 2, name: "PhantomMid", avatar: "PM", rank: 2, country: "🇯🇵", positions: ["CM", "CAM"], wins: 21, losses: 9, goals: 54, assists: 78, premium: true, quote: "Space is something you create.", awards: [{ icon: "🎯", name: "Playmaker ×2" }, { icon: "🏆", name: "Champion" }], description: "The architect behind countless victories. Where others see chaos, he finds space. No player in Frontier history has created more clear-cut chances." },
  { id: 3, name: "IronKeeper", avatar: "IK", rank: 3, country: "🇩🇪", positions: ["GK"], wins: 19, losses: 11, goals: 2, assists: 5, premium: false, quote: "Nothing gets past.", awards: [{ icon: "🧤", name: "Golden Glove" }, { icon: "🛡️", name: "Def. MVP" }], description: "A wall between the posts. Holds the highest save percentage in Frontier history and has anchored three different championship contenders." },
  { id: 4, name: "TacticalWolf", avatar: "TW", rank: 4, country: "🇪🇸", positions: ["CB", "CDM"], wins: 18, losses: 12, goals: 8, assists: 22, premium: false, quote: "Read the game before it happens.", awards: [{ icon: "🐺", name: "Ironwall" }], description: "Calm, composed, terrifying to play against. Anchors every defence he joins with an almost supernatural reading of the game." },
  { id: 5, name: "BlitzWinger", avatar: "BW", rank: 5, country: "🇫🇷", positions: ["LW", "RW"], wins: 16, losses: 14, goals: 61, assists: 49, premium: true, quote: "Catch me if you can.", awards: [{ icon: "⚡", name: "Speedster" }], description: "Pure pace, pure directness. Turns defenders inside out with relentless width and one-on-one aggression — a nightmare on the break." },
  { id: 6, name: "CommanderK", avatar: "CK", rank: 6, country: "🇬🇧", positions: ["CB", "RB"], wins: 15, losses: 15, goals: 5, assists: 18, premium: false, quote: "Always in the right place.", awards: [], description: "A consistent, reliable presence at the back. Teammates point to him as one of the most dependable defenders in the server." },
];
const frontiers = [
  { season: "Season 4", date: "Jun 2025", status: "live", winner: null, teams: 14, topScorer: "PhantomMid", goals: 43 },
  { season: "Season 3", date: "Sep 2024", status: "done", winner: "StrikerX", teams: 12, topScorer: "BlitzWinger", goals: 112 },
  { season: "Season 2", date: "Apr 2024", status: "done", winner: "StrikerX", teams: 10, topScorer: "StrikerX", goals: 89 },
  { season: "Season 1", date: "Jan 2024", status: "done", winner: "PhantomMid", teams: 8, topScorer: "StrikerX", goals: 67 },
];
const rankColor = (r) => r === 1 ? "#FFD24A" : r === 2 ? "#C8D2E0" : r === 3 ? "#E0915A" : T.dim;
const winRateN = (w, l) => (!w && !l) ? 0 : Math.round((w / (w + l)) * 100);

/* ───────── glass + shared ───────── */
const glass = (e = {}) => ({ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(22px) saturate(1.3)", WebkitBackdropFilter: "blur(22px) saturate(1.3)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 18, boxShadow: "0 10px 44px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)", ...e });
const Avatar = ({ initials, size = 44, ring }) => (<div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,rgba(150,170,230,0.5),rgba(70,90,160,0.35))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_D, color: "#fff", fontSize: size * 0.34, flexShrink: 0, border: ring ? `2px solid ${ring}` : "1px solid rgba(255,255,255,0.18)", letterSpacing: 1 }}>{initials}</div>);
const Head = memo(({ title, sub, accent }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}><Bolt size={20} color={accent} /><h1 style={{ fontFamily: FONT_D, color: T.text, fontSize: 34, letterSpacing: "0.02em", margin: 0, lineHeight: 1 }}>{title}</h1></div>
    <p style={{ color: T.dim, fontFamily: FONT_B, fontSize: 13, margin: "8px 0 0 32px" }}>{sub}</p>
  </div>
));

/* ───────── count-up ───────── */
function CountUp({ end, suffix = "", dur = 1000 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, start; const step = (t) => { if (!start) start = t; const p = Math.min((t - start) / dur, 1); const e = 1 - Math.pow(1 - p, 3); setV(end * e); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [end, dur]);
  return <>{Math.round(v)}{suffix}</>;
}

/* ───────── tilt wrapper ───────── */
function Tilt({ children, max = 7, style }) {
  const ref = useRef(null);
  const move = (e) => { const el = ref.current; if (!el) return; const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5; el.style.transform = `perspective(900px) rotateX(${-py * max}deg) rotateY(${px * max}deg)`; };
  const reset = () => { if (ref.current) ref.current.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)"; };
  return <div ref={ref} onPointerMove={move} onPointerLeave={reset} style={{ transition: "transform 0.25s ease-out", transformStyle: "preserve-3d", ...style }}>{children}</div>;
}

/* ───────── pages ───────── */
const FrontierPage = memo(() => {
  const accent = REALMS[0].accent;
  return (
    <div style={{ padding: "28px 18px 96px", maxWidth: 680, margin: "0 auto" }}>
      <Head title="THE FRONTIER" sub="Every server draft, archived in full." accent={accent} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {frontiers.map((f, i) => (
          <div key={i} className="rise" style={{ animationDelay: `${i * 70}ms`, ...glass({ padding: 20, borderLeft: `3px solid ${f.status === "live" ? REALMS[2].accent : accent}`, position: "relative", overflow: "hidden" }) }}>
            {f.status === "live" && <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, background: `radial-gradient(circle,${rgba(REALMS[2].accent, 0.2)},transparent 70%)` }} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontFamily: FONT_D, color: T.text, fontSize: 26, letterSpacing: "0.02em" }}>{f.season.toUpperCase()}</span>
                  {f.status === "live" && <span style={{ background: rgba(REALMS[2].accent, 0.18), color: REALMS[2].accent, fontSize: 9, fontWeight: 800, padding: "3px 7px", borderRadius: 5, letterSpacing: 1.5, fontFamily: FONT_B }}>● LIVE</span>}
                </div>
                <div style={{ color: T.dim, fontFamily: FONT_M, fontSize: 11, marginTop: 4 }}>{f.date} · {f.teams} TEAMS · {f.goals} GOALS</div>
              </div>
              {f.winner ? (<div style={{ textAlign: "right" }}><div style={{ color: T.faint, fontFamily: FONT_M, fontSize: 9, letterSpacing: "0.14em" }}>CHAMPION</div><div style={{ color: T.gold, fontFamily: FONT_D, fontSize: 20, marginTop: 2 }}>🏆 {f.winner}</div></div>) : <div style={{ color: REALMS[2].accent, fontFamily: FONT_M, fontSize: 12 }}>IN PROGRESS…</div>}
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}><div style={{ color: T.faint, fontFamily: FONT_M, fontSize: 9, letterSpacing: "0.1em" }}>TOP SCORER</div><div style={{ color: T.text, fontFamily: FONT_B, fontSize: 14, fontWeight: 600, marginTop: 3 }}>{f.topScorer}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
});

const RankingsPage = memo(({ onOpen, meId }) => {
  const accent = REALMS[1].accent; const [q, setQ] = useState("");
  const list = players.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ padding: "28px 18px 96px", maxWidth: 680, margin: "0 auto" }}>
      <Head title="RANKINGS" sub="The Frontier ladder. Tap a player to open their profile." accent={accent} />
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="◍ Search players…" style={{ width: "100%", padding: "13px 16px", marginBottom: 16, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, color: T.text, fontFamily: FONT_B, fontSize: 14, outline: "none", backdropFilter: "blur(10px)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((p, i) => {
          const me = p.id === meId;
          return (
            <div key={p.id} className="rise" onClick={() => onOpen(p)} style={{ animationDelay: `${i * 55}ms`, ...glass({ padding: "12px 14px", display: "flex", alignItems: "center", gap: 13, cursor: "pointer", outline: me ? `1.5px solid ${accent}` : "none", background: me ? rgba(accent, 0.1) : "rgba(255,255,255,0.05)" }) }}>
              <span style={{ fontFamily: FONT_D, fontSize: 22, color: rankColor(p.rank), width: 26, textAlign: "center", textShadow: p.rank <= 3 ? `0 0 14px ${rankColor(p.rank)}` : "none" }}>{p.rank}</span>
              <Avatar initials={p.avatar} size={42} ring={p.rank <= 3 ? rankColor(p.rank) : null} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ color: T.text, fontFamily: FONT_B, fontWeight: 700, fontSize: 15 }}>{p.name}</span><span style={{ fontSize: 13 }}>{p.country}</span>{p.premium && <Bolt size={9} color={T.gold} />}{me && <span style={{ color: accent, fontSize: 9, fontFamily: FONT_M, fontWeight: 700, letterSpacing: 1 }}>YOU</span>}</div>
                <div style={{ color: T.dim, fontFamily: FONT_M, fontSize: 10, marginTop: 2 }}>{p.positions.join(" · ")}</div>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}><Num v={p.goals} l="G" /><Num v={p.assists} l="A" /><span style={{ background: rgba(T.win, 0.13), color: T.win, padding: "4px 9px", borderRadius: 7, fontSize: 12, fontWeight: 700, fontFamily: FONT_M }}>{winRateN(p.wins, p.losses)}%</span></div>
            </div>
          );
        })}
        {list.length === 0 && <div style={{ color: T.faint, fontFamily: FONT_B, fontSize: 14, textAlign: "center", padding: 36 }}>No players match "{q}".</div>}
      </div>
    </div>
  );
});
const Num = ({ v, l }) => (<div style={{ textAlign: "center" }}><div style={{ color: T.text, fontFamily: FONT_D, fontSize: 17 }}>{v}</div><div style={{ color: T.faint, fontFamily: FONT_M, fontSize: 8 }}>{l}</div></div>);

const ProfilePage = memo(({ player, isOwn }) => {
  const accent = REALMS[2].accent, aGlow = lighten(accent, 0.35);
  if (!player) return null;
  const stats = [{ l: "WINS", v: player.wins, s: "", c: T.win }, { l: "LOSS", v: player.losses, s: "", c: T.loss }, { l: "GOALS", v: player.goals, s: "", c: T.gold }, { l: "ASSIST", v: player.assists, s: "", c: aGlow }, { l: "WIN%", v: winRateN(player.wins, player.losses), s: "%", c: T.win }];
  return (
    <div style={{ padding: "28px 18px 96px", maxWidth: 600, margin: "0 auto" }}>
      <Head title={isOwn ? "YOUR PROFILE" : "PROFILE"} sub={isOwn ? "This is how the server sees you." : `Viewing ${player.name}`} accent={accent} />
      <Tilt style={{ marginBottom: 12 }}>
        <div style={glass({ padding: 24, position: "relative", overflow: "hidden" })}>
          <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, background: `radial-gradient(circle,${rgba(accent, 0.25)},transparent 70%)` }} />
          <div style={{ display: "flex", gap: 18, alignItems: "center", position: "relative" }}>
            <Avatar initials={player.avatar} size={82} ring={rankColor(player.rank)} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}><span style={{ fontFamily: FONT_D, color: T.text, fontSize: 32, letterSpacing: "0.02em" }}>{player.name.toUpperCase()}</span><span style={{ fontSize: 22 }}>{player.country}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9 }}>
                <span style={{ fontFamily: FONT_D, fontSize: 20, color: rankColor(player.rank) }}>#{player.rank}</span>
                {player.positions.map(p => <span key={p} style={{ background: "rgba(255,255,255,0.08)", color: T.text, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: FONT_M }}>{p}</span>)}
                {player.premium && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: rgba(T.gold, 0.14), padding: "3px 9px", borderRadius: 7 }}><Bolt size={9} color={T.gold} /><span style={{ color: T.gold, fontSize: 9, fontWeight: 800, fontFamily: FONT_M, letterSpacing: 1 }}>PREMIUM</span></span>}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 18, padding: "14px 18px", background: "rgba(255,255,255,0.035)", borderLeft: `2px solid ${accent}`, borderRadius: 10 }}>
            <span style={{ color: T.text, fontFamily: "Georgia,serif", fontStyle: "italic", fontSize: 16 }}>"{player.quote}"</span>
            {isOwn && <span style={{ display: "block", color: accent, fontSize: 11, fontFamily: FONT_M, marginTop: 7, cursor: "pointer" }}>✎ EDIT QUOTE · COUNTRY</span>}
          </div>
        </div>
      </Tilt>
      <div key={player.id} style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 12 }}>
        {stats.map(s => (<div key={s.l} style={glass({ padding: "16px 4px", textAlign: "center" })}><div style={{ fontFamily: FONT_D, fontSize: 26, color: s.c, lineHeight: 1 }}><CountUp end={s.v} suffix={s.s} /></div><div style={{ color: T.dim, fontFamily: FONT_M, fontSize: 8, letterSpacing: "0.06em", marginTop: 4 }}>{s.l}</div></div>))}
      </div>
      {player.awards.length > 0 && (
        <div style={glass({ padding: 20, marginBottom: 12 })}>
          <h3 style={{ fontFamily: FONT_D, color: T.text, fontSize: 15, letterSpacing: "0.08em", margin: "0 0 13px" }}>AWARDS</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{player.awards.map((a, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.055)", padding: "9px 13px", borderRadius: 10 }}><span style={{ fontSize: 19 }}>{a.icon}</span><span style={{ color: T.text, fontFamily: FONT_B, fontSize: 13, fontWeight: 600 }}>{a.name}</span></div>))}</div>
        </div>
      )}
      <div style={glass({ padding: 22, borderLeft: `3px solid ${accent}` })}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}><Bolt size={13} color={accent} /><h3 style={{ fontFamily: FONT_D, color: accent, fontSize: 14, letterSpacing: "0.1em", margin: 0 }}>SCOUTING REPORT</h3></div>
        <p style={{ color: T.text, fontFamily: FONT_B, fontSize: 14.5, lineHeight: 1.75, margin: 0, opacity: 0.92 }}>{player.description}</p>
      </div>
    </div>
  );
});

/* ───────── root ───────── */
export default function InazumaStorm() {
  const ME = players[2];
  const [index, setIndex] = useState(1);
  const [viewed, setViewed] = useState(ME);
  const [intro, setIntro] = useState(true);

  const wrapRef = useRef(null), trackRef = useRef(null), skyRef = useRef(null), fxRef = useRef(null), pillRef = useRef(null), flashRef = useRef(null), lightRef = useRef(null);
  const offset = useRef(1), target = useRef(1), prevF = useRef(1), energy = useRef(0);
  const drag = useRef({ on: false, lock: null, sx: 0, sy: 0, base: 1, dx: 0, lastX: 0, lastT: 0, vel: 0 });
  const bolts = useRef([]), embers = useRef([]), rain = useRef([]), shocks = useRef([]), flash = useRef({ a: 0, c: REALMS[1].accent });
  const reduced = useRef(false), finePointer = useRef(false);

  const strike = (accentHex, big = false) => {
    const cv = fxRef.current; if (!cv) return; const W = cv.width, H = cv.height;
    const b = makeBolt(W, H); bolts.current.push(b);
    if (big || Math.random() < 0.4) bolts.current.push(makeBolt(W, H));
    shocks.current.push({ x: b.pts[0][0], y: b.pts[0][1], r: 0, life: 1 });
    flash.current = { a: reduced.current ? 0.22 : (big ? 0.7 : 0.5), c: accentHex };
  };
  const animTo = (i, doStrike = true) => { i = clamp(i, 0, 2); target.current = i; setIndex(i); if (doStrike) strike(REALMS[i].accent); };
  const openPlayer = (p) => { setViewed(p); animTo(2); };

  /* setup */
  useEffect(() => {
    reduced.current = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    finePointer.current = window.matchMedia && window.matchMedia("(pointer:fine)").matches;
    const sky = skyRef.current, fx = fxRef.current;
    const resize = () => {
      const cw = wrapRef.current.clientWidth, ch = wrapRef.current.clientHeight;
      sky.width = Math.max(2, Math.floor(cw * 0.4)); sky.height = Math.max(2, Math.floor(ch * 0.4));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5); fx.width = cw * dpr; fx.height = ch * dpr;
      embers.current = Array.from({ length: reduced.current ? 0 : 50 }, () => spawnEmber(fx.width, fx.height));
      rain.current = Array.from({ length: reduced.current ? 0 : 90 }, () => spawnRain(fx.width, fx.height));
    };
    resize(); window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  /* intro */
  useEffect(() => {
    if (reduced.current) { setIntro(false); return; }
    const t1 = setTimeout(() => strike(REALMS[1].accent, true), 340);
    const t2 = setTimeout(() => setIntro(false), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  /* ambient strikes */
  useEffect(() => {
    let id; const sched = () => { id = setTimeout(() => { if (!reduced.current) strike(realmAt(offset.current).accentHex, Math.random() < 0.25); sched(); }, 3600 + Math.random() * 5000); };
    sched(); return () => clearTimeout(id);
  }, []);

  /* main loop */
  useEffect(() => {
    let raf;
    const frame = (now) => {
      const W = wrapRef.current ? wrapRef.current.clientWidth : 1, d = drag.current;
      if (d.on && d.lock === "h") offset.current = clamp(d.base - d.dx / W, 0, 2);
      else { offset.current += (target.current - offset.current) * 0.15; if (Math.abs(target.current - offset.current) < 0.0004) offset.current = target.current; }
      const f = offset.current, r = realmAt(f);
      const spd = Math.abs(f - prevF.current); prevF.current = f;
      energy.current = clamp(lerp(energy.current, clamp(spd * 16, 0, 1), 0.3), 0, 1);

      if (trackRef.current) trackRef.current.style.transform = `translate3d(${-f * 33.3333}%,0,0)`;
      if (pillRef.current) { pillRef.current.style.left = `calc(${(f / 3) * 100}% + 5px)`; pillRef.current.style.background = `linear-gradient(120deg,${r.accent},${lighten(r.accent, 0.5)})`; pillRef.current.style.boxShadow = `0 0 ${20 + energy.current * 30}px ${rgba(r.accentHex, 0.55 + energy.current * 0.4)}`; }
      if (flashRef.current) flashRef.current.style.opacity = String(clamp(flash.current.a * 0.45, 0, 0.45));

      drawSky(skyRef.current, now, r, energy.current);
      drawFx(fxRef.current, now, r.accentHex, bolts.current, embers.current, rain.current, shocks.current, flash.current, reduced.current, energy.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* pointer */
  const onDown = (e) => { const d = drag.current; d.on = true; d.lock = null; d.sx = e.clientX; d.sy = e.clientY; d.base = offset.current; d.dx = 0; d.lastX = e.clientX; d.lastT = performance.now(); d.vel = 0; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} };
  const onMove = (e) => {
    if (finePointer.current && lightRef.current) { lightRef.current.style.left = e.clientX + "px"; lightRef.current.style.top = e.clientY + "px"; lightRef.current.style.opacity = "1"; }
    const d = drag.current; if (!d.on) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.lock && (Math.abs(dx) > 7 || Math.abs(dy) > 7)) d.lock = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    if (d.lock === "h") { if (e.cancelable) e.preventDefault(); d.dx = dx; const t = performance.now(); d.vel = (e.clientX - d.lastX) / (t - d.lastT + 1); d.lastX = e.clientX; d.lastT = t; }
  };
  const onUp = () => { const d = drag.current; if (d.lock === "h") { let o = offset.current, tgt = Math.round(o); if (d.vel < -0.4) tgt = Math.ceil(o); else if (d.vel > 0.4) tgt = Math.floor(o); animTo(clamp(tgt, 0, 2)); } d.on = false; d.lock = null; };

  return (
    <div ref={wrapRef} style={{ height: "100vh", overflow: "hidden", position: "relative", fontFamily: FONT_B, background: "#04050c" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;} body{margin:0;}
        *::-webkit-scrollbar{width:0;height:0;}
        .ina-scroll{-ms-overflow-style:none;scrollbar-width:none;}
        @keyframes rise{from{opacity:0;transform:translateY(16px) scale(0.98);}to{opacity:1;transform:none;}}
        .rise{animation:rise 0.6s cubic-bezier(0.2,0.7,0.2,1) both;}
        @keyframes introTitle{0%{opacity:0;letter-spacing:18px;filter:blur(8px);transform:scale(1.15);}60%{opacity:1;filter:blur(0);}100%{opacity:1;letter-spacing:4px;transform:scale(1);}}
        @keyframes pillShine{0%{transform:translateX(-120%);}100%{transform:translateX(220%);}}
      `}</style>

      {/* storm sky (low-res, upscaled) behind frosted glass */}
      <canvas ref={skyRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />
      <canvas ref={fxRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", background: "radial-gradient(125% 80% at 50% 0%, transparent 52%, rgba(0,0,0,0.6) 100%)" }} />

      {/* header + swipe bar */}
      <div style={{ position: "relative", zIndex: 10, padding: "16px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }}><Bolt size={18} color={T.gold} /><span style={{ fontFamily: FONT_D, color: T.text, fontSize: 22, letterSpacing: 3 }}>INAZUMA <span style={{ color: T.gold }}>FC</span></span></div>
        <div style={{ position: "relative", display: "flex", maxWidth: 460, margin: "0 auto", ...glass({ padding: 5, borderRadius: 16 }) }}>
          <div ref={pillRef} style={{ position: "absolute", top: 5, bottom: 5, width: "calc(33.3333% - 6px)", borderRadius: 12, left: "calc(33.3333% + 5px)", overflow: "hidden", zIndex: 0 }}>
            <div style={{ position: "absolute", inset: 0, width: "40%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)", animation: "pillShine 3.2s ease-in-out infinite" }} />
          </div>
          {REALMS.map((s, i) => (<button key={s.id} onClick={() => animTo(i)} style={{ flex: 1, position: "relative", zIndex: 1, border: "none", background: "transparent", padding: "11px 4px", cursor: "pointer", color: index === i ? "#fff" : T.dim, fontFamily: FONT_B, fontWeight: 700, fontSize: 13, letterSpacing: "0.03em", transition: "color 0.3s", textShadow: index === i ? "0 1px 8px rgba(0,0,0,0.5)" : "none" }}>{s.label}</button>))}
        </div>
      </div>

      {/* track */}
      <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ position: "absolute", top: 102, left: 0, right: 0, bottom: 0, overflow: "hidden", touchAction: "pan-y", zIndex: 5 }}>
        <div ref={trackRef} style={{ display: "flex", width: "300%", height: "100%", transform: "translate3d(-33.3333%,0,0)", willChange: "transform" }}>
          <div className="ina-scroll" style={{ width: "33.3333%", height: "100%", overflowY: "auto", touchAction: "pan-y" }}><FrontierPage /></div>
          <div className="ina-scroll" style={{ width: "33.3333%", height: "100%", overflowY: "auto", touchAction: "pan-y" }}><RankingsPage onOpen={openPlayer} meId={ME.id} /></div>
          <div className="ina-scroll" style={{ width: "33.3333%", height: "100%", overflowY: "auto", touchAction: "pan-y" }}><ProfilePage player={viewed} isOwn={viewed?.id === ME.id} /></div>
        </div>
      </div>

      {/* screen flash + pointer light */}
      <div ref={flashRef} style={{ position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none", background: "#fff", opacity: 0, mixBlendMode: "overlay" }} />
      <div ref={lightRef} style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", transform: "translate(-50%,-50%)", background: "radial-gradient(circle,rgba(255,255,255,0.1),transparent 65%)", pointerEvents: "none", zIndex: 6, opacity: 0, mixBlendMode: "screen", transition: "opacity 0.4s" }} />

      {/* dots */}
      <div style={{ position: "absolute", bottom: 18, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 8, zIndex: 10 }}>
        {REALMS.map((s, i) => (<button key={i} onClick={() => animTo(i)} style={{ width: i === index ? 26 : 7, height: 7, borderRadius: 4, border: "none", padding: 0, cursor: "pointer", background: i === index ? s.accent : "rgba(255,255,255,0.28)", boxShadow: i === index ? `0 0 12px ${s.accent}` : "none", transition: "all 0.35s" }} />))}
      </div>

      {/* cinematic intro overlay */}
      <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "#04050c", display: "flex", alignItems: "center", justifyContent: "center", opacity: intro ? 1 : 0, pointerEvents: intro ? "auto" : "none", transition: "opacity 0.9s ease 0.2s" }}>
        <div style={{ textAlign: "center", animation: "introTitle 1.3s cubic-bezier(0.2,0.7,0.2,1) both" }}>
          <Bolt size={56} color={T.gold} style={{ filter: `drop-shadow(0 0 24px ${rgba(T.gold, 0.7)})` }} />
          <div style={{ fontFamily: FONT_D, color: T.text, fontSize: 46, letterSpacing: 4, marginTop: 10 }}>INAZUMA <span style={{ color: T.gold }}>FC</span></div>
          <div style={{ fontFamily: FONT_M, color: T.dim, fontSize: 11, letterSpacing: 6, marginTop: 8 }}>FRONTIER LEAGUE</div>
        </div>
      </div>
    </div>
  );
}

/* ───────── canvas: storm sky ───────── */
const BLOBS = [{ x: 0.3, y: 0.3, fx: 0.00007, fy: 0.00005, rx: 0.55, a: 0.5 }, { x: 0.7, y: 0.25, fx: 0.00009, fy: 0.00006, rx: 0.5, a: 0.42 }, { x: 0.5, y: 0.55, fx: 0.00006, fy: 0.00008, rx: 0.6, a: 0.4 }, { x: 0.2, y: 0.7, fx: 0.0001, fy: 0.00005, rx: 0.45, a: 0.32 }, { x: 0.82, y: 0.65, fx: 0.00008, fy: 0.00009, rx: 0.5, a: 0.34 }];
function drawSky(cv, now, r, energy) {
  if (!cv) return; const ctx = cv.getContext("2d"); const W = cv.width, H = cv.height;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, r.top); g.addColorStop(1, r.bottom); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "lighter";
  for (const b of BLOBS) {
    const cx = (b.x + Math.sin(now * b.fx) * 0.12) * W, cy = (b.y + Math.cos(now * b.fy) * 0.12) * H, rad = b.rx * W * (0.9 + energy * 0.25);
    const col = (b.a > 0.4) ? r.accent : r.accent2;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    rg.addColorStop(0, rgba(col, (b.a * (0.5 + energy * 0.5)).toFixed(3))); rg.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.2832); ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

/* ───────── canvas: fx ───────── */
function spawnEmber(W, H) { return { x: Math.random() * W, y: H + Math.random() * H, vy: 0.3 + Math.random() * 0.9, vx: (Math.random() - 0.5) * 0.3, r: 0.6 + Math.random() * 1.8, a: 0.1 + Math.random() * 0.5, ph: Math.random() * 6.28 }; }
function spawnRain(W, H) { return { x: Math.random() * W, y: Math.random() * H, len: 12 + Math.random() * 26, sp: 7 + Math.random() * 9, a: 0.04 + Math.random() * 0.1 }; }
function makeBolt(W, H) {
  const x0 = W * (0.18 + Math.random() * 0.64); const pts = [[x0, 0]]; let x = x0, y = 0; const segs = 17 + Math.floor(Math.random() * 8); const step = H / segs;
  for (let i = 0; i < segs; i++) { y += step * (0.7 + Math.random() * 0.6); x += (Math.random() - 0.5) * W * 0.075; pts.push([x, y]); }
  const branches = [];
  for (let i = 4; i < pts.length - 2; i++) { if (Math.random() < 0.2) { let bx = pts[i][0], by = pts[i][1]; const bp = [[bx, by]]; const n = 3 + Math.floor(Math.random() * 4); for (let j = 0; j < n; j++) { bx += (Math.random() - 0.3) * W * 0.07; by += step * 0.85; bp.push([bx, by]); } branches.push(bp); } }
  return { pts, branches, life: 1 };
}
function poly(ctx, pts, w, color, alpha) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.shadowBlur = 20; ctx.shadowColor = color; ctx.stroke(); ctx.shadowBlur = 0; }
function drawFx(cv, now, accentHex, bolts, embers, rain, shocks, flash, reduced, energy) {
  if (!cv) return; const ctx = cv.getContext("2d"); const W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
  if (!reduced) {
    ctx.strokeStyle = rgba(accentHex, 0.5); ctx.lineWidth = 1;
    for (const d of rain) { d.y += d.sp; d.x += d.sp * 0.18; if (d.y > H) { d.y = -d.len; d.x = Math.random() * W; } ctx.globalAlpha = d.a; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * 0.18, d.y - d.len); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "lighter";
    for (const e of embers) { e.y -= e.vy * (1 + energy); e.x += e.vx + Math.sin(now / 900 + e.ph) * 0.25; if (e.y < -10) { e.y = H + 10; e.x = Math.random() * W; } const tw = 0.6 + Math.sin(now / 500 + e.ph) * 0.4; ctx.globalAlpha = e.a * tw * (0.7 + energy * 0.6); ctx.fillStyle = accentHex; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.2832); ctx.fill(); }
    ctx.globalCompositeOperation = "source-over";
  }
  if (flash.a > 0.01) { ctx.globalAlpha = flash.a * 0.2; ctx.fillStyle = flash.c; ctx.fillRect(0, 0, W, H); flash.a *= 0.86; ctx.globalAlpha = 1; }
  ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let i = shocks.length - 1; i >= 0; i--) { const s = shocks[i]; s.r += W * 0.012; s.life -= 0.04; if (s.life <= 0) { shocks.splice(i, 1); continue; } ctx.globalAlpha = s.life * 0.5; ctx.lineWidth = 2 * s.life; ctx.strokeStyle = accentHex; ctx.shadowBlur = 16; ctx.shadowColor = accentHex; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.stroke(); ctx.shadowBlur = 0; }
  for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i], a = b.life; poly(ctx, b.pts, 8, accentHex, a * 0.18); poly(ctx, b.pts, 2.2, "#FFFFFF", a * 0.95); for (const br of b.branches) poly(ctx, br, 1.4, accentHex, a * 0.5); b.life -= 0.048; if (b.life <= 0) bolts.splice(i, 1); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
}
