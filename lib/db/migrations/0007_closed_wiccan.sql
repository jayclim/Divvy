ALTER TABLE "users" ADD COLUMN "subscription_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_paused" boolean DEFAULT false NOT NULL;