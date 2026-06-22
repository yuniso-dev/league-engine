export type NicknameInput = {
  displayName: string;
  rank: number | null;
  provisional: boolean;
  position1: string | null;
  position2: string | null;
  hidePositions: boolean;
};

/**
 * Format a Discord nickname (max 32 chars) from a player's profile.
 *
 * Format: [#rank ]name[ | pos1/pos2]
 *   - rank prefix only when ranked (rank !== null) AND not provisional
 *   - positions shown as ??/?? when unset; omitted entirely when hidePositions
 *   - result is always truncated to 32 chars and never empty
 */
export function formatNickname(p: NicknameInput): string {
  let name = p.displayName || 'Player';

  if (p.rank !== null && !p.provisional) {
    name = `#${p.rank} ${name}`;
  }

  if (!p.hidePositions) {
    const pos1 = p.position1 ?? '??';
    const pos2 = p.position2 ?? '??';
    name = `${name} | ${pos1}/${pos2}`;
  }

  return name.slice(0, 32);
}
