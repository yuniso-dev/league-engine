'use client';
import type { VoiceNowEntry } from '@inazuma/db';
import { Avatar } from '@/components/ui/Avatar';
import { T, FONT_B, FONT_D, FONT_M, glass, rgba } from '@/lib/realm-colors';

// Live "who's in voice" card, fed by the Discord bot mirroring voice channels
// into the database. Renders nothing when the channels are empty.

const LIVE_RED = '#FF4E4E';

export function VoiceNowCard({ voice }: { voice: VoiceNowEntry[] }) {
  if (voice.length === 0) return null;

  const byChannel = new Map<string, VoiceNowEntry[]>();
  for (const v of voice) {
    const list = byChannel.get(v.channelName) ?? [];
    list.push(v);
    byChannel.set(v.channelName, list);
  }

  return (
    <div style={{ ...glass({ padding: 18 }), marginBottom: 14, border: `1px solid ${rgba(LIVE_RED, 0.3)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: LIVE_RED,
          boxShadow: `0 0 10px ${LIVE_RED}`,
          animation: 'voicePulse 1.6s ease-in-out infinite',
        }} />
        <h3 style={{ fontFamily: FONT_D, color: T.text, fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
          LIVE IN VOICE
        </h3>
        <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint }}>{voice.length}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[...byChannel.entries()].map(([channel, people]) => (
          <div key={channel}>
            <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 1, color: T.faint, marginBottom: 6 }}>
              🔊 {channel.toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {people.map((p, i) => (
                <span
                  key={`${p.displayName}-${i}`}
                  title={p.displayName}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 999, padding: '3px 10px 3px 4px',
                  }}
                >
                  <Avatar initials={p.displayName.slice(0, 2).toUpperCase()} src={p.avatarUrl} size={22} />
                  <span style={{ fontFamily: FONT_B, fontSize: 12, color: T.text }}>{p.displayName}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <style>{'@keyframes voicePulse{0%,100%{opacity:0.55}50%{opacity:1}}'}</style>
    </div>
  );
}
