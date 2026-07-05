import type { Metadata } from 'next';
import Link from 'next/link';
import { glass, T, FONT_D, FONT_B, FONT_M, REALMS, rgba, lighten } from '@/lib/realm-colors';
import { BackPill } from '@/components/ui/BackPill';
import { Bolt } from '@/components/ui/Bolt';

// The in-site field guide: how the league works, for anyone new — no DB, no
// auth, fully static, so it loads instantly and can be linked anywhere
// (Discord announcements included).

export const metadata: Metadata = {
  title: 'How it works — INAZUMA FC',
  description: 'Ranks, Frontiers, the Reveal, milestones and the bot — everything a new INAZUMA FC player needs to know.',
};

const FRONTIER = REALMS[0].accent;   // blue
const RANKINGS = REALMS[1].accent;   // violet
const PROFILE  = REALMS[2].accent;   // orange

function Section({ accent, kicker, title, children }: {
  accent: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 34 }}>
      <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 2.5, color: accent, marginBottom: 6 }}>
        {kicker}
      </div>
      <h2 style={{ fontFamily: FONT_D, fontSize: 24, letterSpacing: 1, color: T.text, margin: '0 0 14px' }}>
        {title}
      </h2>
      <div style={{
        height: 1, marginBottom: 18,
        background: `linear-gradient(90deg, ${rgba(accent, 0.6)}, transparent 60%)`,
      }} />
      {children}
    </section>
  );
}

function Card({ icon, title, children, accent }: {
  icon: string;
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div style={glass({ padding: '16px 18px' })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
        <span style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>
        <span style={{ fontFamily: FONT_D, fontSize: 14.5, letterSpacing: 1, color: accent ?? T.text }}>
          {title}
        </span>
      </div>
      <p style={{ fontFamily: FONT_B, fontSize: 13.5, color: T.dim, margin: 0, lineHeight: 1.65 }}>
        {children}
      </p>
    </div>
  );
}

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: 12,
};

function Step({ n, text }: { n: number; text: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '7px 12px', borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
      fontFamily: FONT_M, fontSize: 11.5, color: T.dim, whiteSpace: 'nowrap',
    }}>
      <span style={{ color: FRONTIER, fontFamily: FONT_D }}>{n}</span> {text}
    </span>
  );
}

export default function GuidePage() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'radial-gradient(ellipse at 50% -10%, #101b38 0%, #0a0e1c 55%, #04050c 100%)',
      padding: '34px 18px 80px',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Bolt size={22} color={FRONTIER} />
          <h1 style={{ fontFamily: FONT_D, fontSize: 34, letterSpacing: 1, color: T.text, margin: 0, lineHeight: 1 }}>
            HOW IT WORKS
          </h1>
        </div>
        <p style={{ fontFamily: FONT_B, fontSize: 14.5, color: T.dim, margin: '10px 0 0 34px', lineHeight: 1.6, maxWidth: 560 }}>
          INAZUMA FC is a competitive football league that lives in Discord and on this
          site. You build a player card, play <b style={{ color: T.text }}>Frontiers</b>,
          and climb a live <b style={{ color: T.text }}>Elo ladder</b>. Here&apos;s the whole
          thing in five minutes.
        </p>

        {/* 1 — getting in */}
        <Section accent={FRONTIER} kicker="STEP ONE" title="GETTING IN">
          <div style={grid}>
            <Card icon="🔗" title="SIGN IN WITH DISCORD">
              One tap authorises with Discord — phone or PC, nothing to install.
              Your Discord account is your identity across the whole league.
            </Card>
            <Card icon="🪪" title="BUILD YOUR PLAYER CARD">
              Pick your display name, one or two positions (ST, CB, GK…) and your
              country. Flags show on the ladder next to your name.
            </Card>
            <Card icon="🎨" title="MAKE IT YOURS">
              Hit ✎ EDIT PROFILE on your profile for your quote, bio and an accent
              colour that re-tints the site just for you.
            </Card>
          </div>
        </Section>

        {/* 2 — the ladder */}
        <Section accent={RANKINGS} kicker="THE RANKINGS TAB" title="THE LADDER">
          <div style={grid}>
            <Card icon="⚡" title="ELO — YOUR RATING" accent={RANKINGS}>
              Everyone starts at 1000, tied at #1. Ranked matches move it: beating
              stronger teams earns more, and winning by a bigger margin counts extra.
              Your first 5 games are <b style={{ color: T.text }}>placement games</b> —
              you&apos;re &ldquo;provisional&rdquo; until they&apos;re done.
            </Card>
            <Card icon="🌩️" title="THE REVEAL" accent={RANKINGS}>
              Results bank up during the week, then the Elo drop happens all at once:
              ratings move, ranks redraw, your graph updates — and the bot restamps
              every nickname in Discord. One shared moment, not a slow drip.
            </Card>
            <Card icon="📊" title="YOUR STAT LINE" accent={RANKINGS}>
              Every ladder row shows G/A (goals/assists — clean sheets for keepers),
              GW (games won), WR (win rate) and ELO. Ties share a rank — if you and a
              rival are level, you&apos;re both #4.
            </Card>
          </div>
        </Section>

        {/* 3 — frontiers */}
        <Section accent={FRONTIER} kicker="MATCH DAY" title="FRONTIERS">
          <p style={{ fontFamily: FONT_B, fontSize: 13.5, color: T.dim, margin: '0 0 14px', lineHeight: 1.6 }}>
            A Frontier is a one-day tournament — the heartbeat of the league. It runs like this:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
            <Step n={1} text="⚡ Sign up on the Frontier card" />
            <Step n={2} text="🎙️ Join the voice channel" />
            <Step n={3} text="🧩 Get drafted into a team" />
            <Step n={4} text="📋 Group stage" />
            <Step n={5} text="🏁 Knockout" />
            <Step n={6} text="🏆 Champion" />
          </div>
          <div style={grid}>
            <Card icon="🎙️" title="SHOWING UP IS THE SIGNUP">
              On the day, being in the voice channel is what gets you drafted — an
              admin snapshots the call and builds balanced teams from everyone in it.
              Sign up early so the numbers are known; show up so you&apos;re in the pool.
            </Card>
            <Card icon="⚽" title="EVERY GOAL IS ON RECORD">
              Goals, assists and clean sheets are logged per match. They feed the
              Frontier&apos;s leaderboards, the all-time records, your profile
              milestones — and clean sheets count automatically when your side
              concedes zero.
            </Card>
            <Card icon="🏛️" title="CHAMPIONS ARE FOREVER">
              The winning team, the awards and the records go into the Hall of Fame,
              season by season. Win one and it&apos;s never forgotten.
            </Card>
          </div>
        </Section>

        {/* 4 — profile */}
        <Section accent={PROFILE} kicker="YOUR LEGACY" title="PROFILE, MILESTONES & AWARDS">
          <div style={grid}>
            <Card icon="📈" title="YOUR CAREER, GRAPHED" accent={PROFILE}>
              Rating history after every Reveal, peak Elo and peak rank on record,
              your last five matches for form — plus a share link (/p/…) you can drop
              anywhere.
            </Card>
            <Card icon="🏟️" title="14 MILESTONES" accent={PROFILE}>
              From FRONTIER DEBUT to CHAMPION — they unlock automatically as you play,
              score, assist and win. Locked ones stay &ldquo;unscouted&rdquo; until you
              earn them.
            </Card>
            <Card icon="🏅" title="TROPHY CABINET" accent={PROFILE}>
              Awards like the Golden Boot are granted after Frontiers and live on your
              profile, your ladder row and the Hall of Fame.
            </Card>
          </div>
        </Section>

        {/* 5 — the bot */}
        <Section accent="#3DDC97" kicker="IN DISCORD" title="THE BOT">
          <div style={grid}>
            <Card icon="🏷️" title="YOUR RANK, IN YOUR NAME" accent="#3DDC97">
              After each Reveal your Discord nickname carries your standing —
              #3 Name | ST — so the pecking order is visible in the member list
              without opening the site.
            </Card>
            <Card icon="🤖" title="COMMANDS FOR EVERYONE" accent="#3DDC97">
              /leaderboard posts the current rankings in the channel; /profile shows
              any player&apos;s card. The pinned rankings message keeps itself up to
              date after every Reveal.
            </Card>
          </div>
        </Section>

        {/* CTA */}
        <div style={{
          ...glass({ padding: '22px 24px', borderRadius: 18 }),
          marginTop: 36,
          border: `1px solid ${rgba(FRONTIER, 0.4)}`,
          background: `linear-gradient(100deg, ${rgba(FRONTIER, 0.14)}, rgba(255,255,255,0.03) 60%)`,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontFamily: FONT_D, fontSize: 18, letterSpacing: 1.5, color: T.text }}>
              READY? THE LADDER IS WAITING.
            </div>
            <div style={{ fontFamily: FONT_B, fontSize: 13, color: T.dim, marginTop: 4 }}>
              Sign in, build your card, and hit ⚡ SIGN UP on the next Frontier.
            </div>
          </div>
          <Link
            href="/"
            className="tap"
            style={{
              padding: '11px 22px', borderRadius: 12,
              background: FRONTIER, color: '#fff', textDecoration: 'none',
              fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, whiteSpace: 'nowrap',
            }}
          >
            ⚡ ENTER INAZUMA FC
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: 26 }}>
          <BackPill href="/" label="BACK TO INAZUMA FC" accent={lighten(FRONTIER, 0.15)} />
        </div>
      </div>
    </div>
  );
}
