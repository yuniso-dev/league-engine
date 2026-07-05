/** Emoji tag sequence (black flag + tag letters) — how England/Scotland/Wales
 *  flags are encoded. Discord renders these; Windows browsers don't, which is
 *  why the website uses <FlagIcon> images instead. */
function tagFlag(tag: string): string {
  return String.fromCodePoint(
    0x1f3f4,
    ...[...tag].map(c => 0xe0000 + c.charCodeAt(0)),
    0xe007f,
  );
}

/** Subdivision codes (ISO 3166-2) → emoji. Northern Ireland has no emoji
 *  flag, so it falls back to the Union Jack. */
const SUBDIVISION_FLAGS: Record<string, string | null> = {
  'GB-ENG': tagFlag('gbeng'),
  'GB-SCT': tagFlag('gbsct'),
  'GB-WLS': tagFlag('gbwls'),
  'GB-NIR': null, // fall through to GB
};

/** ISO 3166-1 alpha-2 (or GB-XXX subdivision) code → flag emoji.
 *  Shared by the website and the Discord bot. */
export function flagEmoji(code: string | null): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();

  if (/^[A-Z]{2}-[A-Z]{2,3}$/.test(upper)) {
    const sub = SUBDIVISION_FLAGS[upper];
    if (sub) return sub;
    // Unknown or emoji-less subdivision: use the parent country's flag.
    return flagEmoji(upper.slice(0, 2));
  }

  if (!/^[A-Z]{2}$/.test(upper)) return null;
  return String.fromCodePoint(
    0x1f1e6 + upper.charCodeAt(0) - 65,
    0x1f1e6 + upper.charCodeAt(1) - 65,
  );
}
