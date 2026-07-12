import { type Client, EmbedBuilder } from 'discord.js';

// Posting to configured feed channels (currently the Frontier results feed).
// Kept generic so the alerts / audit-log channels can reuse sendToChannel later.
//
// Every failure is a warn-once no-op: a wrong ID or a missing permission must
// never break a poll pass — the result is already saved to the site regardless.

const SITE = process.env.SITE_URL ?? 'https://inazuma-fc.vercel.app';

// Brand palette (mirrors the site's announcement embeds).
const BLUE = 0x3d8bff;
const AMBER = 0xffb020; // DNF / forfeit-tinged results
const GREEN = 0x3ddc97; // casual win
const RED = 0xff5b5b;   // casual loss
const SLATE = 0x8a94a6; // casual draw

// Warn-once per channel so a persistent misconfig doesn't spam the logs.
const warned = new Set<string>();

/** Post a string or embed to a channel by ID. Silent, self-healing no-op on
 *  any problem (missing channel, not text-based, no send permission). */
export async function sendToChannel(
  client: Client<true>,
  channelId: string,
  payload: string | { embeds: EmbedBuilder[] },
): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased() || !('send' in channel)) {
      if (!warned.has(channelId)) {
        warned.add(channelId);
        console.warn(`[channels] ${channelId} is missing or not a channel I can post to — check the ID and that I can see it.`);
      }
      return;
    }
    await channel.send(typeof payload === 'string' ? { content: payload } : payload);
  } catch (e) {
    if (!warned.has(channelId)) {
      warned.add(channelId);
      console.warn(`[channels] could not post to ${channelId} (grant me View + Send Messages + Embed Links) —`, e instanceof Error ? e.message : e);
    }
  }
}

// ── Frontier result embed ─────────────────────────────────────────────────────

export type ResultPlayerLine = {
  teamId: string;
  eaName: string;
  goals: number;
  assists: number;
  mom: boolean;
  rating: number | null;
};

export type FrontierResultInput = {
  tournamentName: string;
  matchId: string;          // OUR fixture id (links to the match centre)
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeTeamId: string;
  awayTeamId: string;
  dnf: boolean;
  players: ResultPlayerLine[];
};

/** Escape the handful of characters that would break Discord markdown, so a
 *  gamertag like `*_Kai_*` renders literally rather than as formatting. */
function esc(name: string): string {
  return name.replace(/([\\*_~`|>])/g, '\\$1').slice(0, 80);
}

function scorerLines(players: ResultPlayerLine[]): string {
  const goals = players
    .filter(p => p.goals > 0)
    .sort((a, b) => b.goals - a.goals);
  if (goals.length === 0) return '—';
  return goals.map(p => `⚽ ${esc(p.eaName)}${p.goals > 1 ? `  ×${p.goals}` : ''}`).join('\n');
}

function pickMotm(players: ResultPlayerLine[]): ResultPlayerLine | null {
  const flagged = players.find(p => p.mom);
  if (flagged) return flagged;
  const rated = players.filter(p => p.rating != null);
  if (rated.length === 0) return null;
  return rated.reduce((best, p) => (p.rating! > best.rating! ? p : best));
}

/** Build the results-feed embed: a clean scoreline that links to the match
 *  centre, each side's scorers side-by-side, the player of the match, and the
 *  assist-makers. Neutral blue; amber when a side quit (DNF). */
export function frontierResultEmbed(r: FrontierResultInput): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setAuthor({ name: '⚡ FRONTIER RESULT' })
    .setTitle(`${esc(r.homeTeam)}  ${r.homeScore}–${r.awayScore}  ${esc(r.awayTeam)}`)
    .setURL(`${SITE}/frontier/match/${r.matchId}`)
    .setColor(r.dnf ? AMBER : BLUE)
    .setFooter({ text: `INAZUMA FC · ${r.tournamentName}${r.dnf ? ' · DNF' : ''}` })
    .setTimestamp(new Date());

  const motm = pickMotm(r.players);
  const descParts: string[] = [];
  if (motm) {
    descParts.push(`⭐ **Player of the Match** — ${esc(motm.eaName)}${motm.rating != null ? ` · ${motm.rating.toFixed(1)}` : ''}`);
  }
  if (r.dnf) {
    descParts.push('⚠️ *A player quit — EA\'s scoreline may be a forfeit.*');
  }
  if (descParts.length > 0) embed.setDescription(descParts.join('\n'));

  const homePlayers = r.players.filter(p => p.teamId === r.homeTeamId);
  const awayPlayers = r.players.filter(p => p.teamId === r.awayTeamId);
  embed.addFields(
    { name: `${esc(r.homeTeam)} · ${r.homeScore}`, value: scorerLines(homePlayers), inline: true },
    { name: `${esc(r.awayTeam)} · ${r.awayScore}`, value: scorerLines(awayPlayers), inline: true },
  );

  const assisters = r.players
    .filter(p => p.assists > 0)
    .sort((a, b) => b.assists - a.assists)
    .map(p => `${esc(p.eaName)}${p.assists > 1 ? `  ×${p.assists}` : ''}`);
  if (assisters.length > 0) {
    embed.addFields({ name: '🅰️ Assists', value: assisters.join('  ·  '), inline: false });
  }

  embed.addFields({ name: '​', value: `[**Lineups & full stats →**](${SITE}/frontier/match/${r.matchId})`, inline: false });

  return embed;
}

// ── Casual club result embed ──────────────────────────────────────────────────

export type CasualResultInput = {
  clubId: string;
  clubName: string;
  opponentName: string | null;
  ourGoals: number;
  oppGoals: number;
  result: 'win' | 'loss' | 'draw';
  matchType: string; // 'league' | 'playoff'
  playedAt: Date;
  players: {
    eaName: string;
    rating: number | null;
    goals: number;
    assists: number;
    saves: number;
    mom: boolean;
  }[];
};

/** One compact squad line: name, rating, then only the stats that happened. */
function squadLine(p: CasualResultInput['players'][number]): string {
  return (
    (p.mom ? '⭐ ' : '') +
    `**${esc(p.eaName)}**` +
    (p.rating != null ? `  ${p.rating.toFixed(1)}` : '') +
    (p.goals > 0 ? `  ·  ⚽ ${p.goals}` : '') +
    (p.assists > 0 ? `  ·  🅰️ ${p.assists}` : '') +
    (p.saves > 0 ? `  ·  🧤 ${p.saves}` : '')
  );
}

/** Build the casual-feed embed: colour-coded W/L/D scoreline linking to the
 *  club page, plus a stat line for EVERY teammate who played (rating always;
 *  goals/assists/saves when non-zero; ⭐ marks the player of the match). */
export function casualResultEmbed(r: CasualResultInput): EmbedBuilder {
  const verdict = r.result === 'win' ? 'WIN' : r.result === 'loss' ? 'LOSS' : 'DRAW';
  const colour = r.result === 'win' ? GREEN : r.result === 'loss' ? RED : SLATE;

  const embed = new EmbedBuilder()
    .setAuthor({ name: `🎮 CASUAL · ${verdict}` })
    .setTitle(`${esc(r.clubName)}  ${r.ourGoals}–${r.oppGoals}  ${esc(r.opponentName ?? 'Unknown opponent')}`)
    .setURL(`${SITE}/casual/club/${r.clubId}`)
    .setColor(colour)
    .setFooter({ text: `INAZUMA FC · ${r.clubName} · ${r.matchType === 'playoff' ? 'Playoffs' : 'League'}` })
    .setTimestamp(r.playedAt);

  // Best performance first: rating desc, unrated last.
  const squad = [...r.players].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  if (squad.length > 0) {
    // Discord caps a field value at 1024 chars — a full 11 fits comfortably,
    // but clamp defensively so a weird EA payload can never break the post.
    const lines: string[] = [];
    let used = 0;
    for (const p of squad) {
      const line = squadLine(p);
      if (used + line.length + 1 > 1000) { lines.push('…'); break; }
      lines.push(line);
      used += line.length + 1;
    }
    embed.addFields({ name: '👥 Squad', value: lines.join('\n'), inline: false });
  }

  embed.addFields({ name: '​', value: `[**Club page & leaderboard →**](${SITE}/casual/club/${r.clubId})`, inline: false });

  return embed;
}
