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
