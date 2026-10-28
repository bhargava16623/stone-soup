import { relations } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// All money is stored as integer cents in `currency` (USD for now).

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const urgency = pgEnum("urgency", ["low", "medium", "high"]);
export const needStatus = pgEnum("need_status", ["draft", "open", "funded", "delivered", "verified"]);
export const fairPrice = pgEnum("fair_price", ["fair", "below_market", "above_market", "no_benchmark"]);
export const orderStatus = pgEnum("order_status", ["created", "captured", "failed"]);
export const orderSource = pgEnum("order_source", ["direct", "agent"]);
export const deliveryVerdict = pgEnum("delivery_verdict", ["pending", "verified", "flagged"]);

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
  slug: text().notNull().unique(),
  name: text().notNull(),
  city: text().notNull(),
  country: text().notNull(),
  // Donations for a need are paid straight to this account (PayPal `payee`).
  paypalEmail: text().notNull(),
  paypalMerchantId: text(),
  trustScore: integer().notNull().default(50),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Market comparison: the product IDs are fixed so later re-pricing compares like with like. */
export interface Benchmark {
  query: string;
  currency: string;
  medianCents: number;
  lowCents: number;
  highCents: number;
  products: { id: string; title: string; priceCents: number; domain: string; imageUrl?: string }[];
  checkedAt: string;
}

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
    // Computed when the item is added, so publishing a need doesn't wait on a market search.
    benchmark: jsonb().$type<Benchmark>(),
    active: boolean().notNull().default(true),
  },
  (t) => [index().on(t.vendorId)],
);

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
    deliveredUnits: integer().notNull().default(0),
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

/** One PayPal checkout. It can fund several needs (one purchase unit each) plus an optional NGO gift. */
export const orders = pgTable("orders", {
  id: serial().primaryKey(),
  paypalOrderId: text().notNull().unique(),
  status: orderStatus().notNull().default("created"),
  source: orderSource().notNull().default("direct"),
  coverFees: boolean().notNull().default(false),
  // Optional unrestricted gift, paid to this NGO in the same checkout.
  ngoShareNgoId: integer().references(() => ngos.id),
  ngoShareCents: integer().notNull().default(0),
  ngoCaptureId: text(),
  // What the Giving Agent told the donor about its choices.
  agentNote: text(),
  donorName: text(),
  donorEmail: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  capturedAt: timestamp({ withTimezone: true }),
});

/** Units of one need funded by one order. Paid to the need's vendor. */
export const donations = pgTable(
  "donations",
  {
    id: serial().primaryKey(),
    orderId: integer()
      .notNull()
      .references(() => orders.id),
    needId: integer()
      .notNull()
      .references(() => needs.id),
    // PayPal purchase unit reference, e.g. "need_12".
    referenceId: text().notNull(),
    units: integer().notNull(),
    // Units × unit price, plus fee cover if the donor chose it.
    vendorAmountCents: integer().notNull(),
    feeCoverCents: integer().notNull().default(0),
    captureId: text(),
    captured: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.needId), index().on(t.orderId)],
);

export interface DeliveryCheck {
  matchesItem: boolean;
  estimatedQuantity: number | null;
  looksAuthentic: boolean;
  concerns: string[];
}

/** NGO's confirmation that the vendor delivered, with a photo checked by Gemini. */
export const deliveries = pgTable(
  "deliveries",
  {
    id: serial().primaryKey(),
    needId: integer()
      .notNull()
      .references(() => needs.id),
    units: integer().notNull(),
    note: text(),
    photo: bytea().notNull(),
    photoMime: text().notNull(),
    verdict: deliveryVerdict().notNull().default("pending"),
    aiSummary: text(),
    aiCheck: jsonb().$type<DeliveryCheck>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.needId)],
);

/** Personal message to a donor once their gift was delivered. */
export const impactUpdates = pgTable(
  "impact_updates",
  {
    id: serial().primaryKey(),
    donationId: integer()
      .notNull()
      .references(() => donations.id),
    deliveryId: integer()
      .notNull()
      .references(() => deliveries.id),
    message: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.donationId)],
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
  deliveries: many(deliveries),
}));
export const ordersRelations = relations(orders, ({ one, many }) => ({
  donations: many(donations),
  ngoShareNgo: one(ngos, { fields: [orders.ngoShareNgoId], references: [ngos.id] }),
}));
export const donationsRelations = relations(donations, ({ one, many }) => ({
  order: one(orders, { fields: [donations.orderId], references: [orders.id] }),
  need: one(needs, { fields: [donations.needId], references: [needs.id] }),
  impactUpdates: many(impactUpdates),
}));
export const deliveriesRelations = relations(deliveries, ({ one, many }) => ({
  need: one(needs, { fields: [deliveries.needId], references: [needs.id] }),
  impactUpdates: many(impactUpdates),
}));
export const impactUpdatesRelations = relations(impactUpdates, ({ one }) => ({
  donation: one(donations, { fields: [impactUpdates.donationId], references: [donations.id] }),
  delivery: one(deliveries, { fields: [impactUpdates.deliveryId], references: [deliveries.id] }),
}));

export type Ngo = typeof ngos.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type CatalogItem = typeof catalogItems.$inferSelect;
export type Need = typeof needs.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Donation = typeof donations.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type ImpactUpdate = typeof impactUpdates.$inferSelect;
