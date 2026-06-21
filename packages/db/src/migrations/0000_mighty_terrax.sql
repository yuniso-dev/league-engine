-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
DO $$ BEGIN
 CREATE TYPE "public"."account_tier" AS ENUM('free', 'premium');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."match_result" AS ENUM('win', 'loss', 'draw');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."match_stage" AS ENUM('group', 'round_of_16', 'quarter', 'semi', 'final', 'third_place', 'friendly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tournament_status" AS ENUM('upcoming', 'live', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'member');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"season" integer NOT NULL,
	"status" "tournament_status" DEFAULT 'upcoming' NOT NULL,
	"ranked" boolean DEFAULT true NOT NULL,
	"start_date" date,
	"end_date" date,
	"winner_team_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"signed_up_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'discord' NOT NULL,
	"attended" boolean,
	CONSTRAINT "event_signups_tournament_id_user_id_key" UNIQUE("tournament_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"discord_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"position1" varchar(3),
	"position2" varchar(3),
	"hide_positions" boolean DEFAULT false NOT NULL,
	"show_username" boolean DEFAULT true NOT NULL,
	"elo" numeric(7, 2) DEFAULT 1000 NOT NULL,
	"rank" integer,
	"provisional" boolean DEFAULT true NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"peak_elo" numeric(7, 2),
	"peak_rank" integer,
	"initialised" boolean DEFAULT false NOT NULL,
	"initialised_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"is_inactive" boolean DEFAULT false NOT NULL,
	"events_signed_up" integer DEFAULT 0 NOT NULL,
	"events_attended" integer DEFAULT 0 NOT NULL,
	"country" varchar(2),
	"quote" text,
	"bio" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"tier" "account_tier" DEFAULT 'free' NOT NULL,
	"is_blacklisted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" text NOT NULL,
	"captain_id" text,
	"placement" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"home_team_id" uuid NOT NULL,
	"away_team_id" uuid NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"stage" "match_stage" DEFAULT 'group' NOT NULL,
	"ranked" boolean DEFAULT true NOT NULL,
	"played_at" timestamp with time zone,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"team_id" uuid NOT NULL,
	"result" "match_result",
	"goals" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"clean_sheet" boolean DEFAULT false NOT NULL,
	"elo_before" numeric(7, 2),
	"elo_after" numeric(7, 2),
	"elo_change" numeric(6, 2),
	CONSTRAINT "match_participants_match_id_user_id_key" UNIQUE("match_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rating_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"elo" numeric(7, 2) NOT NULL,
	"rank" integer,
	"games_played" integer NOT NULL,
	"week_of" date NOT NULL,
	"elo_change" numeric(6, 2),
	"rank_change" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_history_user_id_week_of_key" UNIQUE("user_id","week_of")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"award_id" uuid NOT NULL,
	"tournament_id" uuid,
	"season" integer,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"current_season" integer DEFAULT 1 NOT NULL,
	"guild_id" text,
	"rankings_message_id" text,
	"elo_base" numeric(7, 2) DEFAULT 1000 NOT NULL,
	"k_placement" integer DEFAULT 60 NOT NULL,
	"k_established" integer DEFAULT 24 NOT NULL,
	"placement_games" integer DEFAULT 5 NOT NULL,
	"decay_weeks" integer DEFAULT 4 NOT NULL,
	"mov_multiplier_cap" numeric(4, 2) DEFAULT 1.75 NOT NULL,
	"last_reveal_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" text NOT NULL,
	"action" text NOT NULL,
	"target_user_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blacklisted_users" (
	"discord_id" text PRIMARY KEY NOT NULL,
	"reason" text,
	"blacklisted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_members" (
	"team_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "team_members_pkey" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tournaments" ADD CONSTRAINT "fk_tournaments_winner_team" FOREIGN KEY ("winner_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_signups" ADD CONSTRAINT "event_signups_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_signups" ADD CONSTRAINT "event_signups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("discord_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teams" ADD CONSTRAINT "teams_captain_id_fkey" FOREIGN KEY ("captain_id") REFERENCES "public"."users"("discord_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teams" ADD CONSTRAINT "teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("discord_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("discord_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_awards" ADD CONSTRAINT "user_awards_award_id_fkey" FOREIGN KEY ("award_id") REFERENCES "public"."awards"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_awards" ADD CONSTRAINT "user_awards_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_awards" ADD CONSTRAINT "user_awards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("discord_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("discord_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("discord_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blacklisted_users" ADD CONSTRAINT "blacklisted_users_blacklisted_by_fkey" FOREIGN KEY ("blacklisted_by") REFERENCES "public"."users"("discord_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("discord_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_signups_tournament" ON "event_signups" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_signups_user" ON "event_signups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_active_ladder" ON "users" USING btree ("initialised","is_inactive");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_elo" ON "users" USING btree ("elo" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_rank" ON "users" USING btree ("rank");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_teams_tournament" ON "teams" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_matches_tournament" ON "matches" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_matches_unprocessed" ON "matches" USING btree ("processed") WHERE (processed = false);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mp_match" ON "match_participants" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mp_user" ON "match_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_history_user_week" ON "rating_history" USING btree ("user_id","week_of");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_team_members_user" ON "team_members" USING btree ("user_id");
*/