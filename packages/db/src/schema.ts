// Hand-crafted from schema.sql for Phase 0 bootstrapping.
// Run `pnpm db:pull` (from packages/db) with DIRECT_URL set to regenerate from the live DB.
import {
  pgTable,
  pgEnum,
  text,
  varchar,
  boolean,
  integer,
  numeric,
  uuid,
  timestamp,
  date,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'member']);
export const accountTierEnum = pgEnum('account_tier', ['free', 'premium']);
export const tournamentStatusEnum = pgEnum('tournament_status', ['upcoming', 'live', 'completed']);
export const matchStageEnum = pgEnum('match_stage', ['group', 'round_of_16', 'quarter', 'semi', 'final', 'third_place', 'friendly']);
export const matchResultEnum = pgEnum('match_result', ['win', 'loss', 'draw']);

// ── Tables ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  discordId:       text('discord_id').primaryKey(),
  username:        text('username').notNull(),
  displayName:     text('display_name').notNull(),
  avatarUrl:       text('avatar_url'),

  position1:       varchar('position1', { length: 3 }),
  position2:       varchar('position2', { length: 3 }),
  hidePositions:   boolean('hide_positions').notNull().default(false),
  showUsername:    boolean('show_username').notNull().default(true),

  elo:             numeric('elo', { precision: 7, scale: 2 }).notNull().default('1000'),
  rank:            integer('rank'),
  provisional:     boolean('provisional').notNull().default(true),
  gamesPlayed:     integer('games_played').notNull().default(0),
  peakElo:         numeric('peak_elo', { precision: 7, scale: 2 }),
  peakRank:        integer('peak_rank'),

  publicId:        text('public_id').unique(),
  initialised:     boolean('initialised').notNull().default(false),
  initialisedAt:   timestamp('initialised_at', { withTimezone: true }),
  lastActiveAt:    timestamp('last_active_at', { withTimezone: true }),
  isInactive:      boolean('is_inactive').notNull().default(false),

  eventsSignedUp:  integer('events_signed_up').notNull().default(0),
  eventsAttended:  integer('events_attended').notNull().default(0),

  country:         varchar('country', { length: 8 }), // ISO 3166-1 or GB-ENG-style subdivision
  quote:           text('quote'),
  bio:             text('bio'),

  title:            text('title'),
  characterNote:    text('character_note'),
  achievements:     text('achievements'),
  showCharacter:    boolean('show_character').notNull().default(true),
  showAchievements: boolean('show_achievements').notNull().default(true),
  showAwards:       boolean('show_awards').notNull().default(true),
  accentColor:      varchar('accent_color', { length: 7 }),

  role:            userRoleEnum('role').notNull().default('member'),
  tier:            accountTierEnum('tier').notNull().default('free'),
  isBlacklisted:   boolean('is_blacklisted').notNull().default(false),

  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Note: winner_team_id FK to teams exists in the DB but is omitted here to break
// the circular reference between tournaments↔teams (TypeScript cannot infer both).
export const tournaments = pgTable('tournaments', {
  id:            uuid('id').primaryKey().defaultRandom(),
  name:          text('name').notNull(),
  season:        integer('season').notNull(),
  status:        tournamentStatusEnum('status').notNull().default('upcoming'),
  ranked:        boolean('ranked').notNull().default(true),
  startDate:     date('start_date'),
  endDate:       date('end_date'),
  winnerTeamId:  uuid('winner_team_id'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const eventSignups = pgTable('event_signups', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  userId:       text('user_id').notNull().references(() => users.discordId, { onDelete: 'cascade' }),
  signedUpAt:   timestamp('signed_up_at', { withTimezone: true }).notNull().defaultNow(),
  source:       text('source').notNull().default('discord'),
  attended:     boolean('attended'),
});

export const teams = pgTable('teams', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  name:         text('name').notNull(),
  captainId:    text('captain_id').references(() => users.discordId),
  placement:    integer('placement'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const teamMembers = pgTable('team_members', {
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.discordId),
}, (table) => ({
  pk: primaryKey({ columns: [table.teamId, table.userId] }),
}));

export const matches = pgTable('matches', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  homeTeamId:   uuid('home_team_id').notNull().references(() => teams.id),
  awayTeamId:   uuid('away_team_id').notNull().references(() => teams.id),
  homeScore:    integer('home_score'),
  awayScore:    integer('away_score'),
  stage:        matchStageEnum('stage').notNull().default('group'),
  ranked:       boolean('ranked').notNull().default(true),
  playedAt:     timestamp('played_at', { withTimezone: true }),
  processed:    boolean('processed').notNull().default(false),
  processedAt:  timestamp('processed_at', { withTimezone: true }),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const matchParticipants = pgTable('match_participants', {
  id:          uuid('id').primaryKey().defaultRandom(),
  matchId:     uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  userId:      text('user_id').notNull().references(() => users.discordId),
  teamId:      uuid('team_id').notNull().references(() => teams.id),
  result:      matchResultEnum('result'),
  goals:       integer('goals').notNull().default(0),
  assists:     integer('assists').notNull().default(0),
  cleanSheet:  boolean('clean_sheet').notNull().default(false),
  eloBefore:   numeric('elo_before', { precision: 7, scale: 2 }),
  eloAfter:    numeric('elo_after', { precision: 7, scale: 2 }),
  eloChange:   numeric('elo_change', { precision: 6, scale: 2 }),
});

export const ratingHistory = pgTable('rating_history', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      text('user_id').notNull().references(() => users.discordId, { onDelete: 'cascade' }),
  elo:         numeric('elo', { precision: 7, scale: 2 }).notNull(),
  rank:        integer('rank'),
  gamesPlayed: integer('games_played').notNull(),
  weekOf:      date('week_of').notNull(),
  eloChange:   numeric('elo_change', { precision: 6, scale: 2 }),
  rankChange:  integer('rank_change'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const awards = pgTable('awards', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  icon:        text('icon'),
  imageUrl:    text('image_url'),
  description: text('description'),
});

export const userAwards = pgTable('user_awards', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       text('user_id').notNull().references(() => users.discordId, { onDelete: 'cascade' }),
  awardId:      uuid('award_id').notNull().references(() => awards.id),
  tournamentId: uuid('tournament_id').references(() => tournaments.id),
  season:       integer('season'),
  awardedAt:    timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
});

export const config = pgTable('config', {
  id:                 integer('id').primaryKey().default(1),
  currentSeason:      integer('current_season').notNull().default(1),
  guildId:            text('guild_id'),
  rankingsMessageId:  text('rankings_message_id'),
  rankingsChannelId:  text('rankings_channel_id'),
  eloBase:            numeric('elo_base', { precision: 7, scale: 2 }).notNull().default('1000'),
  kPlacement:         integer('k_placement').notNull().default(60),
  kEstablished:       integer('k_established').notNull().default(24),
  placementGames:     integer('placement_games').notNull().default(5),
  decayWeeks:         integer('decay_weeks').notNull().default(4),
  movMultiplierCap:   numeric('mov_multiplier_cap', { precision: 4, scale: 2 }).notNull().default('1.75'),
  lastRevealAt:       timestamp('last_reveal_at', { withTimezone: true }),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminActions = pgTable('admin_actions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  adminId:      text('admin_id').notNull().references(() => users.discordId),
  action:       text('action').notNull(),
  targetUserId: text('target_user_id').references(() => users.discordId),
  details:      jsonb('details'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Live voice-channel presence, written by the Discord bot.
export const voicePresence = pgTable('voice_presence', {
  discordId:   text('discord_id').primaryKey().references(() => users.discordId, { onDelete: 'cascade' }),
  channelName: text('channel_name').notNull(),
  joinedAt:    timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
});

export const blacklistedUsers = pgTable('blacklisted_users', {
  discordId:      text('discord_id').primaryKey(),
  reason:         text('reason'),
  blacklistedBy:  text('blacklisted_by').references(() => users.discordId),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// On-demand draft staging: the bot's /checkvc snapshots a voice channel's
// members in here (source 'vc'); admins can also hand-add players ('manual').
// The website's Draft Board reads this and moves players onto teams.
export const draftPool = pgTable('draft_pool', {
  discordId: text('discord_id').primaryKey().references(() => users.discordId, { onDelete: 'cascade' }),
  source:    text('source').notNull().default('vc'),
  addedAt:   timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
});
