CREATE TYPE "public"."digest_frequency" AS ENUM('instant', 'daily', 'weekly', 'none');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('expense_added', 'settlement_received', 'member_joined', 'member_left');--> statement-breakpoint
CREATE TABLE "email_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"invitations" boolean DEFAULT true NOT NULL,
	"expense_added" boolean DEFAULT true NOT NULL,
	"settlement_received" boolean DEFAULT true NOT NULL,
	"member_activity" boolean DEFAULT true NOT NULL,
	"digest_frequency" "digest_frequency" DEFAULT 'daily' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "pending_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"group_id" integer,
	"data" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;