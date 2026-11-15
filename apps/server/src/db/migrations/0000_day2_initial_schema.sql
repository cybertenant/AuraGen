DO $$ BEGIN
  CREATE TYPE "public"."friction_level" AS ENUM('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."ui_adaptation_status" AS ENUM('generated', 'validated', 'rendered', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "form_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "schema_version" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "form_drafts_schema_version_check" CHECK ("schema_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "friction_events" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "session_id" uuid NOT NULL,
  "friction_score" integer NOT NULL,
  "friction_level" "friction_level" NOT NULL,
  "signals" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "friction_events_score_range_check" CHECK ("friction_score" >= 0 AND "friction_score" <= 100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ui_adaptations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "trigger_score" integer NOT NULL,
  "ui_schema" jsonb NOT NULL,
  "model_name" text,
  "generation_time_ms" integer,
  "status" "ui_adaptation_status" DEFAULT 'generated' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ui_adaptations_trigger_score_range_check" CHECK ("trigger_score" >= 0 AND "trigger_score" <= 100)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "form_drafts" ADD CONSTRAINT "form_drafts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "friction_events" ADD CONSTRAINT "friction_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ui_adaptations" ADD CONSTRAINT "ui_adaptations_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_last_seen_at_idx" ON "sessions" USING btree ("last_seen_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "form_drafts_session_id_unique" ON "form_drafts" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friction_events_session_created_idx" ON "friction_events" USING btree ("session_id","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ui_adaptations_session_created_idx" ON "ui_adaptations" USING btree ("session_id","created_at" DESC);