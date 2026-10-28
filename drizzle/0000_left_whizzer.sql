CREATE TYPE "public"."donation_status" AS ENUM('created', 'captured', 'failed');--> statement-breakpoint
CREATE TYPE "public"."fair_price" AS ENUM('fair', 'below_market', 'above_market', 'no_benchmark');--> statement-breakpoint
CREATE TYPE "public"."need_status" AS ENUM('draft', 'open', 'funded', 'delivered', 'verified');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "catalog_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_id" integer NOT NULL,
	"name" text NOT NULL,
	"spec" text NOT NULL,
	"unit" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" serial PRIMARY KEY NOT NULL,
	"need_id" integer NOT NULL,
	"units" integer NOT NULL,
	"vendor_amount_cents" integer NOT NULL,
	"fee_cover_cents" integer DEFAULT 0 NOT NULL,
	"ngo_share_cents" integer DEFAULT 0 NOT NULL,
	"cover_fees" boolean DEFAULT false NOT NULL,
	"paypal_order_id" text NOT NULL,
	"vendor_capture_id" text,
	"ngo_capture_id" text,
	"donor_name" text,
	"donor_email" text,
	"status" "donation_status" DEFAULT 'created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"captured_at" timestamp with time zone,
	CONSTRAINT "donations_paypalOrderId_unique" UNIQUE("paypal_order_id")
);
--> statement-breakpoint
CREATE TABLE "needs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ngo_id" integer NOT NULL,
	"vendor_id" integer NOT NULL,
	"catalog_item_id" integer NOT NULL,
	"title" text NOT NULL,
	"story" text,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"funded_units" integer DEFAULT 0 NOT NULL,
	"urgency" "urgency" DEFAULT 'medium' NOT NULL,
	"deadline" date,
	"status" "need_status" DEFAULT 'open' NOT NULL,
	"benchmark" jsonb,
	"fair_price" "fair_price" DEFAULT 'no_benchmark' NOT NULL,
	"price_justification" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ngos" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"description" text NOT NULL,
	"paypal_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ngos_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"paypal_email" text NOT NULL,
	"paypal_merchant_id" text,
	"trust_score" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs" ADD CONSTRAINT "needs_ngo_id_ngos_id_fk" FOREIGN KEY ("ngo_id") REFERENCES "public"."ngos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs" ADD CONSTRAINT "needs_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs" ADD CONSTRAINT "needs_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_items_vendor_id_index" ON "catalog_items" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "donations_need_id_index" ON "donations" USING btree ("need_id");--> statement-breakpoint
CREATE INDEX "needs_ngo_id_index" ON "needs" USING btree ("ngo_id");--> statement-breakpoint
CREATE INDEX "needs_status_index" ON "needs" USING btree ("status");