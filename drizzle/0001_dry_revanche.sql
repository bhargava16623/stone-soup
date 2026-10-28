ALTER TABLE "deliveries" ADD COLUMN "photo_hash" text NOT NULL;--> statement-breakpoint
CREATE INDEX "deliveries_photo_hash_index" ON "deliveries" USING btree ("photo_hash");