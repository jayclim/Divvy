CREATE TYPE "public"."split_method" AS ENUM('equal', 'custom', 'by_item');--> statement-breakpoint
CREATE TABLE "expense_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_id" integer NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"is_shared_cost" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"share_percentage" numeric(5, 2) DEFAULT '100' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "split_method" text DEFAULT 'equal' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_assignments" ADD CONSTRAINT "item_assignments_item_id_expense_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."expense_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_assignments" ADD CONSTRAINT "item_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;