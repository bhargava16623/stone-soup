CREATE TYPE "public"."ngo_status" AS ENUM('unverified', 'review', 'verified', 'demo');--> statement-breakpoint
ALTER TABLE "ngos" ADD COLUMN "status" "ngo_status" DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "ngos" ADD COLUMN "ein" text;--> statement-breakpoint
ALTER TABLE "ngos" ADD COLUMN "irs_name" text;--> statement-breakpoint
ALTER TABLE "ngos" ADD COLUMN "irs_location" text;--> statement-breakpoint
ALTER TABLE "ngos" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "ngos" ADD COLUMN "verify_token" text;--> statement-breakpoint
ALTER TABLE "ngos" ADD COLUMN "verification" jsonb;--> statement-breakpoint
ALTER TABLE "ngos" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ngos" ADD CONSTRAINT "ngos_ein_unique" UNIQUE("ein");--> statement-breakpoint
-- Charities created before verification existed are the fictional seeded demo charities.
UPDATE "ngos" SET "status" = 'demo';