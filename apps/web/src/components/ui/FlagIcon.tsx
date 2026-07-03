import { countryName } from '@/lib/countries';

// Flag as an image, not an emoji — Windows browsers don't render flag emoji
// (they fall back to bare letter pairs like "GB"), so emoji flags are
// invisible to half the league. flagcdn serves every ISO 3166-1 code.

type Props = {
  code: string | null | undefined;
  /** Rendered width in px (height follows the flag's own ratio). */
  size?: number;
  style?: React.CSSProperties;
};

export function FlagIcon({ code, size = 20, style }: Props) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  const cc = code.toLowerCase();
  const name = countryName(code) ?? code.toUpperCase();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${cc}.png`}
      srcSet={`https://flagcdn.com/w80/${cc}.png 2x`}
      alt={name}
      title={name}
      width={size}
      loading="lazy"
      style={{
        height: 'auto',
        borderRadius: 3,
        boxShadow: '0 0 0 1px rgba(255,255,255,0.18)',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
