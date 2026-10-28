import { relations } from "drizzle-orm";
import { boolean, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, date, index } from "drizzle-orm/pg-core";

// All money is stored as integer cents in `currency` (USD for now).

export const urgency = pgEnum("urgency", ["low", "medium", "high"]);
export const needStatus = pgEnum("need_status", ["draft", "open", "funded", "delivered", "verified"]);
export const fairPrice = pgEnum("fair_price", ["fair", "below_market", "above_market", "no_benchmark"]);
export const donationStatus = pgEnum("donation_status", ["created", "captured", "failed"]);

export const ngos = pgTable("ngos", {
  id: serial().primaryKey(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  city: text().notNull(),
  country: text().notNull(),
  description: text().notNull(),
  // Receives the optional unrestricted share of a gift.
  paypalEmail: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: serial().primaryKey(),
  name: text().notNull(),
  city: text().notNull(),
  country: text().notNull(),
  // Donations for a need are paid straight to this account (PayPal `payee`).
  paypalEmail: text().notNull(),
  paypalMerchantId: text(),
  trustScore: integer().notNull().default(50),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: serial().primaryKey(),
    vendorId: integer()
      .notNull()
      .references(() => vendors.id),
    name: text().notNull(),
    // Concrete spec used for matching and for the market-price search.
    spec: text().notNull(),
    unit: text().notNull(),
    unitPriceCents: integer().notNull(),
    currency: text().notNull().default("USD"),
    imageUrl: text(),
  },
  (t) => [index().on(t.vendorId)],
);

/** Market comparison saved on a need: the product IDs are fixed so later re-pricing compares like with like. */
export interface Benchmark {
  query: string;
  currency: string;
  medianCents: number;
  lowCents: number;
  highCents: number;
  products: { id: string; title: string; priceCents: number; domain: string; imageUrl?: string }[];
  checkedAt: string;
}

export const needs = pgTable(
  "needs",
  {
    id: serial().primaryKey(),
    ngoId: integer()
      .notNull()
      .references(() => ngos.id),
    vendorId: integer()
      .notNull()
      .references(() => vendors.id),
    catalogItemId: integer()
      .notNull()
      .references(() => catalogItems.id),
    title: text().notNull(),
    story: text(),
    quantity: integer().notNull(),
    // Snapshot of the vendor's price when the need was published.
    unitPriceCents: integer().notNull(),
    currency: text().notNull().default("USD"),
    fundedUnits: integer().notNull().default(0),
    urgency: urgency().notNull().default("medium"),
    deadline: date(),
    status: needStatus().notNull().default("open"),
    benchmark: jsonb().$type<Benchmark>(),
    fairPrice: fairPrice().notNull().default("no_benchmark"),
    // Required when the vendor price is above market or there is no benchmark.
    priceJustification: text(),
    imageUrl: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.ngoId), index().on(t.status)],
);

export const donations = pgTable(
  "donations",
  {
    id: serial().primaryKey(),
    needId: integer()
      .notNull()
      .references(() => needs.id),
    units: integer().notNull(),
    // Paid to the vendor: units × unit price (+ fees if the donor covers them).
    vendorAmountCents: integer().notNull(),
    feeCoverCents: integer().notNull().default(0),
    // Optional unrestricted gift paid to the NGO in the same checkout.
    ngoShareCents: integer().notNull().default(0),
    coverFees: boolean().notNull().default(false),
    paypalOrderId: text().notNull().unique(),
    vendorCaptureId: text(),
    ngoCaptureId: text(),
    donorName: text(),
    donorEmail: text(),
    status: donationStatus().notNull().default("created"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    capturedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.needId)],
);

export const ngosRelations = relations(ngos, ({ many }) => ({ needs: many(needs) }));
export const vendorsRelations = relations(vendors, ({ many }) => ({ catalog: many(catalogItems), needs: many(needs) }));
export const catalogItemsRelations = relations(catalogItems, ({ one }) => ({
  vendor: one(vendors, { fields: [catalogItems.vendorId], references: [vendors.id] }),
}));
export const needsRelations = relations(needs, ({ one, many }) => ({
  ngo: one(ngos, { fields: [needs.ngoId], references: [ngos.id] }),
  vendor: one(vendors, { fields: [needs.vendorId], references: [vendors.id] }),
  catalogItem: one(catalogItems, { fields: [needs.catalogItemId], references: [catalogItems.id] }),
  donations: many(donations),
}));
export const donationsRelations = relations(donations, ({ one }) => ({
  need: one(needs, { fields: [donations.needId], references: [needs.id] }),
}));

export type Ngo = typeof ngos.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type CatalogItem = typeof catalogItems.$inferSelect;
export type Need = typeof needs.$inferSelect;
export type Donation = typeof donations.$inferSelect;
