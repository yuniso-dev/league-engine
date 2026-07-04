import 'server-only';

// Discord announcements for the big Frontier moments — signups opening, a
// tournament kicking off, champions crowned, awards won. Posted through a
// Discord channel WEBHOOK (set DISCORD_ANNOUNCE_WEBHOOK on Vercel: Channel
// Settings → Integrations → Webhooks → New Webhook → Copy URL). Rendered as
// INAZUMA FC so it reads like an official post. If the webhook isn't set, or
// the POST fails, every call is a silent no-op — announcements can never break
// an admin action.

const WEBHOOK = process.env.DISCORD_ANNOUNCE_WEBHOOK;
const SITE = process.env.SITE_URL ?? 'https://inazuma-fc.vercel.app';

const BLUE = 0x3d8bff;
const GREEN = 0x3ddc97;
const GOLD = 0xffd24a;

type Embed = {
  title: string;
  description: string;
  url?: string;
  color: number;
  footer: string;
};

async function post(embed: Embed): Promise<void> {
  if (!WEBHOOK) return;
  try {
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'INAZUMA FC',
        embeds: [{
          title: embed.title,
          description: embed.description,
          url: embed.url,
          color: embed.color,
          footer: { text: embed.footer },
          timestamp: new Date().toISOString(),
        }],
      }),
    });
  } catch (e) {
    console.error('[announce] failed:', e instanceof Error ? e.message : e);
  }
}

const footer = (season: number) => `INAZUMA FC · Season ${season}`;

export function announceSignupsOpen(t: { id: string; name: string; season: number }): Promise<void> {
  return post({
    title: `⚡ ${t.name.toUpperCase()} — SIGNUPS OPEN`,
    description:
      `**Season ${t.season}** · a new Frontier is calling.\n\n` +
      'Sign up on the site to claim your place — teams are drafted from the roster on the day. ' +
      'Jump in voice to make sure you get picked.',
    url: `${SITE}/frontier/${t.id}`,
    color: BLUE,
    footer: footer(t.season),
  });
}

export function announceKickoff(t: { id: string; name: string; season: number }): Promise<void> {
  return post({
    title: `🏟️ ${t.name.toUpperCase()} — KICKOFF`,
    description:
      `**Season ${t.season}** · the Frontier is underway.\n\n` +
      'Follow the table, the bracket and every result live on the site.',
    url: `${SITE}/frontier/${t.id}`,
    color: GREEN,
    footer: footer(t.season),
  });
}

export function announceChampion(t: {
  id: string; name: string; season: number; champion: string;
}): Promise<void> {
  return post({
    title: `🏆 ${t.champion.toUpperCase()} — CHAMPIONS`,
    description:
      `**${t.name} · Season ${t.season}**\n\n` +
      `${t.champion} are crowned champions of the Frontier. Their names are written into the Hall of Fame — glory eternal. ⚡`,
    url: `${SITE}/hall-of-fame`,
    color: GOLD,
    footer: footer(t.season),
  });
}

export function announceAward(a: {
  awardName: string; icon: string | null; playerName: string; publicId: string | null; season: number | null;
}): Promise<void> {
  return post({
    title: `${a.icon ?? '🏅'} ${a.awardName.toUpperCase()}`,
    description:
      `**${a.playerName}** earns the ${a.awardName}` +
      (a.season ? ` · Season ${a.season}` : '') + '. A moment for the record books.',
    url: a.publicId ? `${SITE}/p/${a.publicId}` : undefined,
    color: GOLD,
    footer: a.season ? footer(a.season) : 'INAZUMA FC',
  });
}
