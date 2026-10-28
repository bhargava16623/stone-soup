CREATE TABLE "pots" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"need_id" integer NOT NULL,
	"title" text NOT NULL,
	"organizer_name" text NOT NULL,
	"goal_units" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pots_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pot_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pot_note" text;--> statement-breakpoint
ALTER TABLE "pots" ADD CONSTRAINT "pots_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pots_need_id_index" ON "pots" USING btree ("need_id");