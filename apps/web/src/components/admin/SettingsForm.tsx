'use client';
import { useFormState, useFormStatus } from 'react-dom';
import type { ConfigRow } from '@inazuma/db';
import { FONT_B, FONT_D, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { updateConfigAction, type AdminFormState } from '@/app/admin/actions';

type Props = { config: ConfigRow };

const captionStyle: React.CSSProperties = {
  fontFamily: FONT_B,
  fontSize: 12,
  color: T.faint,
  margin: '4px 0 0',
  lineHeight: 1.4,
};

function Field({
  label, caption, children,
}: { label: string; caption: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      <p style={captionStyle}>{caption}</p>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        marginTop: 8,
        padding: '13px 28px',
        background: ADMIN_ACCENT,
        border: 'none',
        borderRadius: 12,
        color: '#fff',
        fontFamily: FONT_D,
        fontSize: 15,
        letterSpacing: 2,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? 'SAVING…' : 'SAVE SETTINGS'}
    </button>
  );
}

export default function SettingsForm({ config }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(updateConfigAction, {});

  return (
    <form action={action}>
      <div style={{ ...glass({ padding: 28 }), marginBottom: 20 }}>
        <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 18 }}>
          SEASON
        </div>
        <div style={{ maxWidth: 220, marginBottom: 8 }}>
          <Field label="Current season" caption="Which season new tournaments default to. Bump this when a new season starts.">
            <input name="currentSeason" type="number" min={1} defaultValue={config.currentSeason} required style={inputBase} />
          </Field>
        </div>
      </div>

      <div style={{ ...glass({ padding: 28 }), marginBottom: 20 }}>
        <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 18 }}>
          ELO TUNING
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field label="Elo base" caption="Starting Elo for new players. Not yet wired into player creation — changing this has no visible effect yet.">
            <input name="eloBase" type="number" step="1" min={1} defaultValue={config.eloBase} required style={inputBase} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="K-factor (placement)" caption="How hard a single placement-game result swings a new player's rating. Higher = faster placement, noisier early rank.">
              <input name="kPlacement" type="number" min={1} defaultValue={config.kPlacement} required style={inputBase} />
            </Field>
            <Field label="K-factor (established)" caption="How hard a single result swings an established player's rating. Higher = faster-moving, lower = more stable.">
              <input name="kEstablished" type="number" min={1} defaultValue={config.kEstablished} required style={inputBase} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Placement games" caption="Number of ranked games before a player switches from the placement K-factor to the established one.">
              <input name="placementGames" type="number" min={1} defaultValue={config.placementGames} required style={inputBase} />
            </Field>
            <Field label="Margin cap" caption="Caps how much a big scoreline can amplify a rating change. 1.0 = margin never matters; higher = blowouts swing rating more.">
              <input name="movMultiplierCap" type="number" step="0.05" min={1} defaultValue={config.movMultiplierCap} required style={inputBase} />
            </Field>
          </div>
        </div>
      </div>

      <div style={{ ...glass({ padding: 28 }), marginBottom: 20 }}>
        <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 18 }}>
          DISCORD (FOR THE BOT — PHASE 5)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Guild ID" caption="Discord server the bot will post rankings/results into. Leave blank until the bot is set up.">
            <input name="guildId" defaultValue={config.guildId ?? ''} autoComplete="off" style={inputBase} />
          </Field>
          <Field label="Rankings message ID" caption="ID of the Discord message the bot will edit to keep rankings up to date. Leave blank until the bot is set up.">
            <input name="rankingsMessageId" defaultValue={config.rankingsMessageId ?? ''} autoComplete="off" style={inputBase} />
          </Field>
        </div>
      </div>

      <div style={{ ...glass({ padding: 28 }), marginBottom: 20 }}>
        <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 18 }}>
          CASUAL — EA FC CLUBS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="EA Club ID(s)" caption="The club the bot polls for casual matches (find it in your club's URL on EA's site). Comma-separate several. Blank = casual sync off.">
            <input name="eaClubIds" defaultValue={config.eaClubIds ?? ''} autoComplete="off" placeholder="e.g. 123456" style={inputBase} />
          </Field>
          <Field label="EA platform" caption="Cross-play pool: common-gen5 (PS5/Xbox Series/PC) or common-gen4 (PS4/Xbox One).">
            <input name="eaPlatform" defaultValue={config.eaPlatform ?? 'common-gen5'} autoComplete="off" style={inputBase} />
          </Field>
        </div>
      </div>

      <div style={{ ...glass({ padding: 28 }), marginBottom: 20 }}>
        <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 18 }}>
          FRONTIER — /FRONTIERINTRO
        </div>
        <Field
          label="Standing rules block"
          caption="Pasted verbatim into the bot's /frontierintro draft — waitlist ritual, no-show policy, similar-skill sub rule, whatever the league lives by. Discord markdown allowed."
        >
          <textarea
            name="frontierRules"
            rows={8}
            defaultValue={config.frontierRules ?? ''}
            placeholder={'e.g.\n• React 🇧 to join the waitlist\n• Leavers are replaced by a similar-skill sub\n• No-shows sit out the next Frontier'}
            style={{ ...inputBase, resize: 'vertical', minHeight: 140, lineHeight: 1.5 }}
          />
        </Field>
      </div>

      {config.lastRevealAt && (
        <p style={{ fontFamily: FONT_B, fontSize: 13, color: T.faint, margin: '0 0 16px' }}>
          Last weekly reveal: {config.lastRevealAt.toISOString().slice(0, 16).replace('T', ' ')} UTC.
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <SubmitButton />
        {state.error && (
          <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 14 }}>{state.error}</span>
        )}
        {state.ok && state.message && (
          <span style={{ fontFamily: FONT_B, color: T.win, fontSize: 14 }}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
