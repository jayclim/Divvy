-- Add split_method column to expenses table
ALTER TABLE "expenses" ADD COLUMN "split_method" text DEFAULT 'equal' NOT NULL;

-- Create expense_items table for storing individual receipt items
CREATE TABLE IF NOT EXISTS "expense_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "expense_id" integer NOT NULL REFERENCES "expenses"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "price" decimal(10, 2) NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "is_shared_cost" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create item_assignments table for tracking who ordered what
CREATE TABLE IF NOT EXISTS "item_assignments" (
  "id" serial PRIMARY KEY NOT NULL,
  "item_id" integer NOT NULL REFERENCES "expense_items"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "share_percentage" decimal(5, 2) DEFAULT '100' NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "expense_items_expense_id_idx" ON "expense_items"("expense_id");
CREATE INDEX IF NOT EXISTS "item_assignments_item_id_idx" ON "item_assignments"("item_id");
CREATE INDEX IF NOT EXISTS "item_assignments_user_id_idx" ON "item_assignments"("user_id");