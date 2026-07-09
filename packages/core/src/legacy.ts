// Parser for the pre-website "Frontier Awards History" archive — the Discord
// message an admin pastes in. It reads edition headers (`## Frontier IX`) and
// the honour lines under them (🏆 Winners / ⚽ Golden Boot / 🧱 Wallside /
// 👟 Sharp's / ❄️ Xavier Frost), pulling the `<@id>` mentions and ignoring
// "N/A". Pure + tolerant of the surrounding markdown (`>`, `**`, `__`, emoji).

import { isRomanNumeral, parseEdition, toRoman } from './editions';

export const LEGACY_CATEGORIES = [
  'champion',
  'golden_boot',
  'wallside',
  'sharps',
  'xavier_frost',
] as const;
export type LegacyCategory = (typeof LEGACY_CATEGORIES)[number];

export type LegacyWinner = { category: LegacyCategory; discordId: string };
export type LegacyEdition = { edition: number; label: string; winners: LegacyWinner[] };

const HEADER = /Frontier\s+([IVXLCDM]+)\b/i;
const MENTION = /<@!?(\d+)>/g;

/** Which honour a line describes, by the label it contains (case-insensitive).
 *  Distinctive substrings, so order only guards accidental overlaps. */
function categoryOf(line: string): LegacyCategory | null {
  const l = line.toLowerCase();
  if (l.includes('boot')) return 'golden_boot';
  if (l.includes('wallside')) return 'wallside';
  if (l.includes('frost')) return 'xavier_frost';
  if (l.includes('sharp')) return 'sharps';
  if (l.includes('winner') || l.includes('champion')) return 'champion';
  return null;
}

function idsIn(line: string): string[] {
  return [...line.matchAll(MENTION)].map(m => m[1]);
}

/** Parse the pasted archive into editions with categorised winners, sorted by
 *  edition ascending. Duplicate mentions within a line are de-duplicated. */
export function parseLegacyArchive(text: string): LegacyEdition[] {
  const byEdition = new Map<number, LegacyEdition>();
  let current: LegacyEdition | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // An edition header is a heading (`#`) whose "Frontier" is followed by a
    // roman numeral — this skips the "Frontier Awards History" title line.
    const headerMatch = line.includes('#') ? HEADER.exec(line) : null;
    if (headerMatch && isRomanNumeral(headerMatch[1])) {
      const parsed = parseEdition(`Frontier ${headerMatch[1]}`);
      if (parsed) {
        current = byEdition.get(parsed.edition) ?? {
          edition: parsed.edition,
          label: `Frontier ${toRoman(parsed.edition)}`,
          winners: [],
        };
        byEdition.set(parsed.edition, current);
        continue;
      }
    }

    if (!current) continue;
    const category = categoryOf(line);
    if (!category) continue;

    const seen = new Set(current.winners.filter(w => w.category === category).map(w => w.discordId));
    for (const id of idsIn(line)) {
      if (seen.has(id)) continue;
      seen.add(id);
      current.winners.push({ category, discordId: id });
    }
  }

  return [...byEdition.values()].sort((a, b) => a.edition - b.edition);
}
