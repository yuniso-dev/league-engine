# INAZUMA FC Discord bot — setup guide

This bot lives in your Discord server and does four things:

- keeps everyone's **nickname** stamped with their rank after each weekly reveal (`#3 Name | ST/GK`)
- keeps one **rankings message** permanently up to date in a channel you choose
- answers **`/leaderboard`** and **`/profile`** for anyone
- automatically registers every server member as a player, and hides people from the rankings if they leave the server

Setup takes about 15 minutes. You'll do three things: create the bot on Discord, tell the site which server is yours, and put the bot on a host so it runs 24/7.

---

## 1. Create the bot on Discord

1. Go to **https://discord.com/developers/applications** and sign in.
2. Click **New Application**, name it (e.g. `INAZUMA FC`), and create it.
3. In the left menu open **Bot**:
   - Click **Reset Token**, then **copy the token**. Treat it like a password — you'll paste it into your host in step 3 and never anywhere else.
   - Scroll to **Privileged Gateway Intents** and switch **SERVER MEMBERS INTENT** to **ON**, then Save. *(Without this the bot cannot see your member list and will fail to start with "Used disallowed intents".)*
4. In the left menu open **OAuth2** and copy your **Client ID** (a long number at the top).
5. Invite the bot to your server by opening this link in your browser — **replace `YOUR_CLIENT_ID`** with the number you just copied:

   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=134302720
   ```

   Pick your server and click **Authorize**. (That permission number = View Channels + Send Messages + Embed Links + Read Message History + **Manage Nicknames**.)

6. **Important — role order:** in your server, open **Server Settings → Roles** and drag the bot's role **above** your members' roles. Discord only lets a bot rename people whose highest role is *below* its own. *(The server owner can never be renamed by any bot — that's a Discord rule, so your own nickname staying put is expected.)*

## 2. Tell the site which server is yours

1. In Discord: **User Settings → Advanced → Developer Mode → ON**.
2. Right-click your server's icon → **Copy Server ID**.
3. On the website: **Admin → Settings → Guild ID** → paste it → Save.

The bot checks for this every 60 seconds, so you can do this before *or* after the bot is running — no restart needed.

## Safe test run first (recommended)

Before putting the bot in your real server, do a dry-run in a **throwaway test server** — with zero risk to your live data.

Why this needs a special mode: the bot uses the *same database* as your website, and normally it hides any player who isn't in the server it's watching. In a test server that would be *all* your real players. **Test mode** fixes this — the bot reads your real data (so `/leaderboard` and `/profile` show real results) but writes **nothing** back to the database.

1. Create a new Discord server (the **+** button → Create My Own) and invite the bot to it with the same link from step 1.5.
2. Copy the **test** server's ID (right-click its icon → Copy Server ID).
3. On your test host, set these **two extra** variables (alongside `DISCORD_BOT_TOKEN`, `DATABASE_URL`, `SITE_URL`):

   | Variable | Value |
   |---|---|
   | `BOT_READ_ONLY` | `true` |
   | `BOT_GUILD_ID` | your **test** server's ID |

4. Start it. The logs will show `⚠ TEST MODE (read-only)`. Now try everything: `/leaderboard`, `/profile`, `/postleaderboard`, `/syncnicks`, `/resetnicknames`. Nickname changes happen only inside the test server; your website's rankings and players stay exactly as they were.
5. When you're happy, **remove** `BOT_READ_ONLY` and `BOT_GUILD_ID` for the real deployment below.

## 3. Put the bot on a host (Railway — recommended)

The bot must run 24/7, which Vercel can't do. Railway (~$5/month hobby plan) deploys straight from your GitHub repo:

1. Go to **https://railway.app** → sign in with GitHub → **New Project → Deploy from GitHub repo** → pick this repository.
2. Open the service's **Settings** and set:
   - **Custom Build Command:** `pnpm install --frozen-lockfile`
     *(this stops Railway from trying to build the website, which belongs to Vercel)*
   - **Custom Start Command:** `pnpm --filter bot start`
3. Open the **Variables** tab and add:

   | Variable | Value |
   |---|---|
   | `DISCORD_BOT_TOKEN` | the token from step 1.3 |
   | `DATABASE_URL` | the **same** Supabase pooler URL (port 6543) your Vercel project uses |
   | `SITE_URL` | `https://inazuma-fc.vercel.app` |
   | `NIXPACKS_NODE_VERSION` | `22` |
   | `DB_POOL_MAX` | `3` *(optional, keeps commands snappy during big syncs)* |

4. Deploy. In the logs you should see `logged in as …` and `serving guild: …`.

## 4. Check that everything works

1. The bot shows **online** in your member list.
2. Type **`/leaderboard`** in any channel — it should reply with the rankings.
3. Go to your rankings channel and run **`/postleaderboard`** (admins only). The message it posts will now update itself after every reveal.
4. Try **`/profile`** — yours, or pick another player.
5. After your next **weekly reveal** on the site, nicknames and the rankings message update within ~5 minutes. To force it immediately, run **`/syncnicks`**.

## Switching from another rank/nickname bot

Two bots must never manage nicknames at the same time — they'll overwrite each other. If you're replacing an old rank bot (especially one that left glitched names like `#58 #69 name [ST/CB] [ST/CB]`), do this **in order**:

1. **Disable the old bot's nickname feature, or remove the old bot.** Do this first so nothing fights our bot.
2. Run **`/resetnicknames`** with `confirm: True` (admins only). This clears **everyone's** nickname back to their plain Discord name, wiping the old bot's leftover tags. On a big server it takes a few minutes and reports the counts when done. *(Note: it also clears nicknames people set themselves — it's a clean slate.)*
3. Run **`/syncnicks`** to stamp your league players with the correct `#rank Name | ST/GK` format.

Our bot rebuilds each nickname from scratch every time, so it can't produce the stacked/duplicated glitch the old bot did.

## Troubleshooting

| Problem | Fix |
|---|---|
| Bot is offline | Check the Railway logs; usually a wrong `DISCORD_BOT_TOKEN`. |
| Log says "Used disallowed intents" | Step 1.3 — turn **SERVER MEMBERS INTENT** on, then redeploy. |
| Log says "No Guild ID configured" | Step 2 — paste your server ID into Admin → Settings. It picks it up within 60s. |
| Slash commands don't appear | The bot registers them on startup *after* the Guild ID is set — check the logs for "registered … slash commands", and try re-opening Discord. |
| Nicknames don't change | Step 1.6 — drag the bot's role above your members' roles. The **server owner** can never be renamed (Discord rule). |
| Rankings message stopped updating | It was probably deleted — run `/postleaderboard` again in the channel you want. |
| "Something went wrong" from a command | Transient database hiccup — try again; if it persists, check `https://inazuma-fc.vercel.app/api/health`. |
