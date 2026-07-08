import type { ChatInputCommandInteraction } from 'discord.js';
import { HONOURS } from '@inazuma/core';
import { getConfig, getLatestOpenTournament, getTournamentCaptains } from '@inazuma/db';

// /frontierintro — generates the Frontier's opening announcement from the
// database: captains, the honours on the line, the league's standing rules
// (Admin → Settings), and the signup link. Posted in the invoking channel as
// a DRAFT for the organiser to copy, punch up, and post — the spoilered
// @everyone never pings from the bot.

const DISCORD_MESSAGE_LIMIT = 2000;

/** Split on paragraph boundaries so no chunk breaks mid-section. */
function chunk(paragraphs: string[]): string[] {
  const out: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    const next = current ? `${current}\n\n${p}` : p;
    if (next.length > DISCORD_MESSAGE_LIMIT - 100 && current) {
      out.push(current);
      current = p;
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out;
}

export async function handleFrontierIntro(
  interaction: ChatInputCommandInteraction,
  siteUrl: string,
): Promise<void> {
  await interaction.deferReply();

  const tournament = await getLatestOpenTournament();
  if (!tournament) {
    await interaction.editReply('⚠ No open Frontier found — create the tournament on the site first (Admin → + NEW).');
    return;
  }

  const [cfg, teams] = await Promise.all([getConfig(), getTournamentCaptains(tournament.id)]);
  const captained = teams.filter(t => t.captainId !== null);

  const paragraphs: string[] = [
    `# ⚡ ${tournament.name.toUpperCase()} — SEASON ${tournament.season}`,
  ];

  // Discord renders a unix timestamp in each viewer's own timezone.
  if (tournament.startTime) {
    const unix = Math.floor(tournament.startTime.getTime() / 1000);
    paragraphs.push(`🗓️ **Kicks off:** <t:${unix}:F> (<t:${unix}:R>)`);
  }

  if (captained.length > 0) {
    paragraphs.push(
      '**Captains**\n' + captained.map(t => `⚔️ **${t.teamName}** — <@${t.captainId}>`).join('\n'),
    );
  }

  paragraphs.push(
    '**Honours up for grabs**\n' + HONOURS.map(h => `${h.icon} **${h.base}** — ${h.description}`).join('\n'),
  );

  paragraphs.push(
    '**Rules**\n' + (cfg.frontierRules?.trim() || '_Set the standing rules block in Admin → Settings and re-run /frontierintro._'),
  );

  paragraphs.push(`**Sign up:** ${siteUrl}/frontier/${tournament.id}`, '||@everyone||');

  const [first, ...rest] = chunk(paragraphs);
  // Draft-for-review: mentions and @everyone must render but never ping.
  await interaction.editReply({ content: first, allowedMentions: { parse: [] } });
  for (const part of rest) {
    await interaction.followUp({ content: part, allowedMentions: { parse: [] } });
  }
}
