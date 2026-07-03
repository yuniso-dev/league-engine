/** ISO 3166-1 alpha-2 code → flag emoji (regional indicator pair).
 *  Shared by the website and the Discord bot. */
export function flagEmoji(code: string | null): string | null {
  if (!code || !/^[a-z]{2}$/i.test(code)) return null;
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    0x1f1e6 + upper.charCodeAt(0) - 65,
    0x1f1e6 + upper.charCodeAt(1) - 65,
  );
}
