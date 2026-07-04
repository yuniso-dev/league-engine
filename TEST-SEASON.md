# INAZUMA FC — Test Season Runbook

A full dress rehearsal with ~44 real players on a **separate database**, exercising
every feature: accounts, signups, voice-aware draft, group stage, knockout,
match stats, awards, the Elo reveal, bot commands and announcements.

The real database is never touched. When the test is over you swap two env vars
back and the site returns to the launch state.

---

## Part 1 — One-time setup (≈20 minutes)

### 1. Create the test database

1. Supabase → **New project**.
   - **Region: London (eu-west-2)** — the site's functions are pinned to London;
     matching regions keeps everything fast.
   - Any strong DB password.
2. Open the **SQL Editor**, paste the entire contents of
   [`packages/db/schema-full.sql`](packages/db/schema-full.sql), and **Run**.
   That one file creates every table, index and enum the app uses (it's the
   original schema with all four migrations folded in).
3. Project Settings → Database → **Connection string → Transaction pooler**
   (port **6543**). Copy it — this is your test `DATABASE_URL`.

### 2. Point the website at it

Vercel → your project → **Settings → Environment Variables**:

| Variable | Action |
|---|---|
| `DATABASE_URL` | **Swap** to the new pooler URL (keep the old value saved somewhere!) |
| `NEXT_PUBLIC_TEST_MODE` | **Add**, value `true` — the header shows **⚠ TEST SEASON** so nobody mistakes the rehearsal for launch |
| `DISCORD_ANNOUNCE_WEBHOOK` | Optional: point at a channel in the test server to see announcements fire |

Then **Deployments → Redeploy**. Everything else (Discord OAuth, domain,
AUTH_SECRET) stays exactly as it is — sign-in works unchanged.

### 3. Point the bot at it

Railway → bot service → **Variables**:

| Variable | Action |
|---|---|
| `DATABASE_URL` | Swap to the same test pooler URL |
| `BOT_READ_ONLY` | **Remove / set to false** — the test needs the bot writing (member sync, nicknames, voice presence) |
| `BOT_GUILD_ID` | Set to the test server's ID **if** you're using a separate Discord server; remove if testing in the main one |

Redeploy the bot. Invite it to the test server if it isn't there
(Administrator or at least Manage Nicknames + Send Messages).

### 4. Make yourself owner

Sign in on the site with Discord (this creates your row in the fresh DB),
complete your profile, then in the Supabase SQL Editor:

```sql
update users set role = 'owner' where username = '<your discord username>';
```

Check that `/admin` now opens. Promote extra helpers the same way with `'admin'`.

### 5. Wire the bot's guild + rankings message

- Admin → Settings → set **Guild ID** to the test server's ID → save.
- In Discord, run the bot's **/postleaderboard** in your rankings channel so the
  auto-updating rankings message exists.
- Quick checks: `/leaderboard`, `/profile`, and join a VC — the **LIVE IN VOICE**
  card on the site's Frontier tab should show you within ~a minute.

---

## Part 2 — Player onboarding (before the day)

Each of the ~44 players, on their phone or PC:

1. Open the site → **Sign in** → Discord authorize.
   (On mobile, Discord asks for a one-time browser login — expected.)
2. Complete the profile (name, positions) → **Settings**: country, quote, bio,
   accent colour (hue wheel).
3. Open the test Frontier and hit **⚡ SIGN UP** on the ROSTER CALL card.

What you're verifying: sign-in on many devices, initialise flow, settings,
flags on the ladder, everyone at rank **#1** (tie-aware). Optionally press
**⚡ RECALCULATE RANKS NOW** (Admin → Settings) once everyone's in.

---

## Part 3 — Season day script

Run these in order — together they touch every feature:

1. **Create the Frontier** — Admin → + NEW ("Test Frontier I", season 1, ranked).
   ➜ *Verifies: signups-open announcement, ROSTER CALL card, signup counter on the Frontier card.*
2. **Players join VC.** ➜ *Green pulse dots on ROSTER CALL + LIVE IN VOICE card.*
3. **Create the teams** (empty) on the tournament page — 4 teams for a
   round-robin + straight final, 6 teams for round-robin + semis.
4. **Draft** — open the **DRAFT BOARD**: filter defaults to *⚡ Signed up*,
   in-VC players float up with green dots; click players onto the active team;
   ☆ to set captains; **↻ VC** to re-check presence as stragglers arrive.
   ➜ *Verifies signups + live voice + attendance counters.*
5. **📋 GROUP FIXTURES** — generates the round robin. Set status **live**.
   ➜ *Kickoff announcement.*
6. **Play + enter results** per fixture (tick who played on each side).
   The **TABLE updates live**; clean sheets are credited automatically when a
   side concedes 0.
7. **⚽ STATS on each result** — enter goals/assists per player.
   ➜ *Feeds leaderboards, milestones, all-time records (EXAMPLE tag disappears).*
8. **🏁 DRAW KNOCKOUT FROM TABLE** once the group is done → results → next
   round → final.
9. **Set status: completed + winner.**
   ➜ *Champion announcement + Hall of Fame plaque.*
10. **Awards** — Admin → Awards: tap the preset chips (Golden Boot etc.),
    then **⚡ GRANT** from each card to the winners.
    ➜ *Award announcements, trophy cabinets, badges on the ladder, Hall of Fame HONOURS.*
11. **The reveal** — Admin → ⚡ REVEAL → preview → **commit**.
    ➜ *Elo moves, tie-aware ranks update, rating-history graphs appear,
    bot renames everyone (#rank prefixes), the Discord rankings message refreshes.*
12. **Sweep the public site**: rankings (medals, W/R, role stats), a few
    profiles (milestones unlocked, LAST 5 MATCHES, report cards), the Frontier
    page (records now real), Hall of Fame, `/p/<id>` share links.

---

## Part 4 — After the test

1. Vercel: restore the original `DATABASE_URL`, delete `NEXT_PUBLIC_TEST_MODE`
   (or set `false`), redeploy.
2. Railway: restore `DATABASE_URL`, re-add `BOT_READ_ONLY=true` if you want the
   bot dormant until launch, redeploy.
3. Keep the test Supabase project around for a few days for reference, then
   delete it. The real database was never touched.

**Collect during the test:** anything slow, any dead tap, any confusing screen —
with device + browser. That list becomes the final pre-launch polish round.
