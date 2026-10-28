import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/db/index.ts";

const urgencyRank = { high: 0, medium: 1, low: 2 } as const;

/** Needs that can still be funded, most urgent first. */
export async function getOpenNeeds() {
  const rows = await db.query.needs.findMany({
    where: (n, { eq }) => eq(n.status, "open"),
    with: { ngo: true, vendor: true, catalogItem: true },
  });
  return rows.sort(
    (a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency] || (a.deadline ?? "").localeCompare(b.deadline ?? ""),
  );
}

export async function getNeed(id: number) {
  if (!Number.isInteger(id)) return undefined;
  return db.query.needs.findFirst({
    where: (n, { eq }) => eq(n.id, id),
    with: {
      ngo: true,
      vendor: true,
      catalogItem: true,
      donations: {
        where: (d, { eq }) => eq(d.captured, true),
        orderBy: (d) => [desc(d.id)],
        limit: 10,
        with: { order: true },
      },
      deliveries: {
        columns: { photo: false },
        orderBy: (d) => [desc(d.createdAt)],
      },
    },
  });
}

export type NeedWithRelations = NonNullable<Awaited<ReturnType<typeof getNeed>>>;

export async function getNgos() {
  return db.query.ngos.findMany({ orderBy: (n, { asc }) => [asc(n.name)] });
}

export async function getNgoDashboard(slug: string) {
  return db.query.ngos.findFirst({
    where: (n, { eq }) => eq(n.slug, slug),
    with: {
      needs: {
        orderBy: (n) => [desc(n.createdAt)],
        with: { vendor: true, catalogItem: true },
      },
    },
  });
}

export async function getVendors() {
  return db.query.vendors.findMany({ orderBy: (v, { asc }) => [asc(v.name)] });
}

export async function getVendorDashboard(slug: string) {
  return db.query.vendors.findFirst({
    where: (v, { eq }) => eq(v.slug, slug),
    with: {
      catalog: { orderBy: (c, { asc }) => [asc(c.name)] },
      needs: { orderBy: (n) => [desc(n.createdAt)], with: { ngo: true, catalogItem: true } },
    },
  });
}

/** Everything a donor needs to follow their gifts, looked up by PayPal order ID. */
export async function getOrderForDonor(paypalOrderId: string) {
  return db.query.orders.findFirst({
    where: (o, { eq }) => eq(o.paypalOrderId, paypalOrderId),
    with: {
      ngoShareNgo: true,
      donations: {
        with: {
          need: { with: { ngo: true, vendor: true, catalogItem: true } },
          impactUpdates: { with: { delivery: { columns: { photo: false } } } },
        },
      },
    },
  });
}

export interface LedgerRow {
  id: number;
  date: string;
  donor: string;
  via: "Direct" | "Giving Agent";
  ngo: string;
  item: string;
  units: number;
  vendor: string;
  amountCents: number;
  feeCoverCents: number;
  priceCheck: string;
  delivery: "Delivered" | "Under review" | "On its way";
  captureId: string | null;
  needId: number;
}

/** Every captured gift, newest first, for the public ledger. Donors are shown by first name only. */
export async function getLedger(): Promise<LedgerRow[]> {
  const rows = await db.query.donations.findMany({
    where: (d, { eq }) => eq(d.captured, true),
    orderBy: (d) => [desc(d.id)],
    with: {
      order: true,
      impactUpdates: { columns: { id: true } },
      need: {
        with: {
          ngo: true,
          vendor: true,
          catalogItem: true,
          deliveries: { columns: { verdict: true } },
        },
      },
    },
  });
  const priceLabel = { fair: "Fair", below_market: "Below market", above_market: "Above market", no_benchmark: "No market data" };
  return rows.map((d) => ({
    id: d.id,
    date: (d.order.capturedAt ?? d.createdAt).toISOString(),
    donor: d.order.donorName?.split(" ")[0] ?? "Anonymous",
    via: d.order.source === "agent" ? "Giving Agent" : "Direct",
    ngo: d.need.ngo.name,
    item: d.need.catalogItem.name,
    units: d.units,
    vendor: d.need.vendor.name,
    amountCents: d.vendorAmountCents,
    feeCoverCents: d.feeCoverCents,
    priceCheck: priceLabel[d.need.fairPrice],
    delivery:
      d.impactUpdates.length > 0
        ? "Delivered"
        : d.need.deliveries.some((x) => x.verdict === "flagged")
          ? "Under review"
          : "On its way",
    captureId: d.captureId,
    needId: d.needId,
  }));
}
