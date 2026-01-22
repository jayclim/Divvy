ALTER TABLE "users" ADD COLUMN "monthly_ai_scans_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_scan_reset" timestamp with time zone;