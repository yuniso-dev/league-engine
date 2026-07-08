import { HONOURS } from '@inazuma/core';

// Builds the Discord-markdown honours announcement from real ceremony data.
// Pure and client-safe — CeremonyBoard recomputes it live as the admin edits
// the numeral / voted-award picks, so what's in the copy-box always matches
// what GRANT ALL will actually mint. The organiser pastes it into Discord and
// adds their own flavour; mentions use <@discordId>, @everyone ships spoilered.

export type CeremonyDraftInput = {
  tournamentName: string;
  season: number;
  numeral: string;
  topScorers: { discordId: string; value: number }[];
  topAssisters: { discordId: string; value: number }[];
  goldenGlove: { discordId: string; value: number } | null;
  /** Computed: highest avg-rated defender(s) with ≥3 games. */
  bestDefenders: { discordId: string; value: number }[];
  pott: { discordId: string } | null;
  champion: {
    teamName: string;
    memberDiscordIds: string[];
    captainDiscordId: string | null;
  } | null;
  /** Team of the Tournament lines (from pickTeamOfTournament); empty = omit. */
  tott: { emoji: string; label: string; players: { discordId: string; value: number }[] }[];
};

const honour = (key: (typeof HONOURS)[number]['key']) => HONOURS.find(h => h.key === key)!;

function line(key: Parameters<typeof honour>[0], numeral: string, body: string): string {
  const h = honour(key);
  return `${h.icon} **${h.base}${numeral ? ` ${numeral}` : ''}** — ${body}`;
}

export function buildCeremonyAnnouncement(input: CeremonyDraftInput): string {
  const n = input.numeral.trim().toUpperCase();
  const mention = (id: string) => `<@${id}>`;
  const lines: string[] = [
    `# 🏆 ${input.tournamentName.toUpperCase()} — HONOURS`,
    `*Season ${input.season} — the Frontier has spoken.*`,
    '',
  ];

  if (input.topScorers.length > 0) {
    lines.push(line('topScorer', n,
      `${input.topScorers.map(w => mention(w.discordId)).join(', ')} (${input.topScorers[0].value} goals)`));
  }
  if (input.topAssisters.length > 0) {
    lines.push(line('topAssister', n,
      `${input.topAssisters.map(w => mention(w.discordId)).join(', ')} (${input.topAssisters[0].value} assists)`));
  }
  if (input.goldenGlove) {
    lines.push(line('goldenGlove', n,
      `${mention(input.goldenGlove.discordId)} (${input.goldenGlove.value.toFixed(2)} avg rating)`));
  }
  if (input.bestDefenders.length > 0) {
    lines.push(line('bestDefender', n,
      `${input.bestDefenders.map(w => mention(w.discordId)).join(', ')} (${input.bestDefenders[0].value.toFixed(2)} avg rating)`));
  }
  if (input.pott) {
    lines.push(line('pott', n, `${mention(input.pott.discordId)} — voted by the league`));
  }
  if (input.champion) {
    lines.push('');
    lines.push(line('champion', n,
      `**${input.champion.teamName}** — ${input.champion.memberDiscordIds.map(mention).join(' ')}`));
    if (input.champion.captainDiscordId) {
      lines.push(line('mrInazuma', n, mention(input.champion.captainDiscordId)));
    }
  }

  if (input.tott.length > 0) {
    lines.push('', '⭐ **Team of the Tournament**');
    for (const t of input.tott) {
      lines.push(`${t.emoji} ${t.label} — ${t.players.map(p => `${mention(p.discordId)} (${p.value.toFixed(2)})`).join(' · ')}`);
    }
  }

  lines.push('', 'GGs to everyone who battled through — see the full records on the site.', '', '||@everyone||');
  return lines.join('\n');
}
