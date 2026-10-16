CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY NOT NULL,
	"room_code" text NOT NULL,
	"token_hash" text NOT NULL,
	"name" text NOT NULL,
	"joined_at" bigint NOT NULL,
	"seen_at" bigint NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"typed" text DEFAULT '' NOT NULL,
	"strokes" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"finished_at" bigint,
	"seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"code" text PRIMARY KEY NOT NULL,
	"host_id" text NOT NULL,
	"passage" text NOT NULL,
	"duration" integer NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"start_at" bigint,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_room_code_rooms_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."rooms"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "limits_expiry_idx" ON "rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "players_room_idx" ON "players" USING btree ("room_code");--> statement-breakpoint
CREATE INDEX "players_session_idx" ON "players" USING btree ("room_code","token_hash");--> statement-breakpoint
CREATE INDEX "rooms_expiry_idx" ON "rooms" USING btree ("expires_at");