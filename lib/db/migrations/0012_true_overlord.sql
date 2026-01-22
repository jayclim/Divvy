CREATE TABLE "email_unsubscribes" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_unsubscribes_email_unique" UNIQUE("email")
);
