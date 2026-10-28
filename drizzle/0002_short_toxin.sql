CREATE TYPE "public"."club_basket_status" AS ENUM('ready', 'paid', 'skipped');--> statement-breakpoint
CREATE TABLE "club_baskets" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"month" text NOT NULL,
	"items" jsonb NOT NULL,
	"rationale" text NOT NULL,
	"total_cents" integer NOT NULL,
	"status" "club_basket_status" DEFAULT 'ready' NOT NULL,
	"paypal_order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"name" text NOT NULL,
	"monthly_budget_cents" integer NOT NULL,
	"causes" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_members_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "club_basket_id" integer;--> statement-breakpoint
ALTER TABLE "club_baskets" ADD CONSTRAINT "club_baskets_member_id_club_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."club_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_baskets_member_id_index" ON "club_baskets" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "club_baskets_member_id_month_index" ON "club_baskets" USING btree ("member_id","month");