'use client';
import { useState } from 'react';
import { FONT_D, T } from '@/lib/realm-colors';

// EA club crest with graceful degradation. EA hosts crest art on a public CDN
// keyed by crestAssetId (custom crests) or teamId (real-team crests); the URL
// pattern is community-documented, not official, so any load failure falls
// back to an initials badge instead of a broken image.

type Props = {
  name: string;
  teamId: string | null;
  crestAssetId: string | null;
  size?: number;
};

function crestUrl(teamId: string | null, crestAssetId: string | null): string | null {
  if (crestAssetId) {
    return `https://media.contentapi.ea.com/content/dam/eacom/fc/pro-clubs/custom-crest-${crestAssetId}.png`;
  }
  if (teamId) {
    return `https://media.contentapi.ea.com/content/dam/eacom/fc/pro-clubs/crest-${teamId}.png`;
  }
  return null;
}

export function ClubCrest({ name, teamId, crestAssetId, size = 44 }: Props) {
  const [broken, setBroken] = useState(false);
  const url = crestUrl(teamId, crestAssetId);

  if (!url || broken) {
    return (
      <div
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: '24%',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT_D,
          fontSize: size * 0.34,
          letterSpacing: 1,
          color: T.dim,
          flexShrink: 0,
        }}
      >
        {name.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '⚽'}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      onError={() => setBroken(true)}
      style={{ objectFit: 'contain', flexShrink: 0 }}
    />
  );
}
