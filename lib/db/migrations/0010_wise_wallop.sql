CREATE TYPE "public"."scan_status" AS ENUM('success', 'failed', 'partial');--> statement-breakpoint
CREATE TABLE "ai_scan_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expense_id" integer,
	"receipt_image_url" text,
	"raw_response" jsonb,
	"status" "scan_status" NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_scan_logs" ADD CONSTRAINT "ai_scan_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_scan_logs" ADD CONSTRAINT "ai_scan_logs_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;