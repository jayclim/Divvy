CREATE TYPE "public"."subscription_status_enum" AS ENUM('on_trial', 'active', 'paused', 'past_due', 'unpaid', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text,
	"variant_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" text NOT NULL,
	"is_usage_based" boolean DEFAULT false,
	"interval" text,
	"interval_count" integer DEFAULT 1,
	"trial_interval" text,
	"trial_interval_count" integer,
	"sort" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_variant_id_unique" UNIQUE("variant_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lemon_squeezy_id" text NOT NULL,
	"order_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"status" "subscription_status_enum" NOT NULL,
	"status_formatted" text,
	"renews_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"price" text NOT NULL,
	"is_usage_based" boolean DEFAULT false,
	"is_paused" boolean DEFAULT false,
	"subscription_item_id" integer,
	"user_id" text NOT NULL,
	"plan_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_lemon_squeezy_id_unique" UNIQUE("lemon_squeezy_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"body" jsonb NOT NULL,
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;