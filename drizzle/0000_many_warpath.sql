CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `limits_expiry_idx` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`joined_at` integer NOT NULL,
	`seen_at` integer NOT NULL,
	`round` integer DEFAULT 1 NOT NULL,
	`typed` text DEFAULT '' NOT NULL,
	`strokes` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`finished_at` integer,
	`seq` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `players_room_idx` ON `players` (`room_code`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`passage` text NOT NULL,
	`duration` integer NOT NULL,
	`round` integer DEFAULT 1 NOT NULL,
	`start_at` integer,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rooms_expiry_idx` ON `rooms` (`expires_at`);