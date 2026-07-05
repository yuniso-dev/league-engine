export type NicknameInput = {
  displayName: string;
  rank: number | null;
  provisional: boolean;
  position1: string | null;
  position2: string | null;
  hidePositions: boolean;
};

/**
 * Normalise a Discord display name for storage and rendering.
 *
 * Discord allows names the site's typography can't honour: emoji, and
 * "fancy font" letters (𝐇𝐚𝐬𝐡𝐌𝐞𝐚𝐧 is Mathematical Bold codepoints, which
 * bypass the site font entirely). NFKC folds those back to plain letters,
 * then emoji/pictographs and invisible formatting characters are stripped.
 * Accented letters (José, Kylian Mbappé) survive untouched.
 *
 * Returns `fallback` when nothing legible is left (an all-emoji name).
 */
export function cleanDisplayName(raw: string, fallback = 'Player'): string {
  const cleaned = raw
    .normalize('NFKC')
    // Emoji & pictographs: symbols, dingbats, flags/regional indicators,
    // skin-tone modifiers, keycap combiners and the emoji tag block.
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2900}-\u{297F}\u{20E3}\u{FE0E}\u{FE0F}\u{E0020}-\u{E007F}]/gu, '')
    // Zero-width and directional formatting characters (invisible, but they
    // break truncation and copy/paste).
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

/**
 * Format a Discord nickname (max 32 chars) from a player's profile.
 *
 * Format: [#rank ]name[ | pos1[/pos2]]
 *   - rank prefix only when ranked (rank !== null) AND not provisional
 *   - only set positions are shown: one → "| CB", both → "| CB/ST",
 *     none → suffix omitted entirely (also omitted when hidePositions)
 *   - result is always truncated to 32 chars and never empty
 */
export function formatNickname(p: NicknameInput): string {
  let name = p.displayName || 'Player';

  if (p.rank !== null && !p.provisional) {
    name = `#${p.rank} ${name}`;
  }

  if (!p.hidePositions) {
    const positions = [p.position1, p.position2].filter(Boolean).join('/');
    if (positions) name = `${name} | ${positions}`;
  }

  return name.slice(0, 32);
}
