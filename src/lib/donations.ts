// Checkout flow: price a basket → create one PayPal order (one purchase unit per need,
// each paid straight to that need's vendor) → donor approves → capture and record.
// Amounts are always computed here from the database, never taken from the client.
import "server-only";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { feeCoverCents, MIN_NGO_SHARE_CENTS } from "./fees.ts";
import { captureOrder, createOrder, MAX_PURCHASE_UNITS, type PurchaseUnit } from "./paypal.ts";

export class DonationError extends Error {}

export interface BasketItem {
  needId: number;
  units: number;
}

export interface BasketLine {
  needId: number;
  units: number;
  title: string;
  itemName: string;
  unit: string;
  ngoId: number;
  ngoName: string;
  vendorName: string;
  vendorEmail: string;
  unitPriceCents: number;
  goodsCents: number;
  feeCents: number;
}

export interface PricedBasket {
  lines: BasketLine[];
  goodsCents: number;
  feeCents: number;
  totalCents: number; // excluding any NGO gift
}

/** Validate a basket against current needs and price it. */
export async function priceBasket(items: BasketItem[], coverFees: boolean): Promise<PricedBasket> {
  if (items.length === 0) throw new DonationError("The basket is empty");
  if (new Set(items.map((i) => i.needId)).size !== items.length) throw new DonationError("Each need can appear once");
  if (items.length > MAX_PURCHASE_UNITS - 1) throw new DonationError(`At most ${MAX_PURCHASE_UNITS - 1} needs per checkout`);
  for (const i of items) {
    if (!Number.isInteger(i.needId) || !Number.isInteger(i.units) || i.units < 1) throw new DonationError("Invalid basket item");
  }

  const rows = await db.query.needs.findMany({
    where: (n) => inArray(n.id, items.map((i) => i.needId)),
    with: { vendor: true, ngo: true, catalogItem: true },
  });

  const lines = items.map((item): BasketLine => {
    const need = rows.find((r) => r.id === item.needId);
    if (!need || need.status !== "open") throw new DonationError(`Need ${item.needId} is not open for donations`);
    const remaining = need.quantity - need.fundedUnits;
    if (item.units > remaining) throw new DonationError(`Only ${remaining} left to fund for "${need.title}"`);
    const goodsCents = item.units * need.unitPriceCents;
    return {
      needId: need.id,
      units: item.units,
      title: need.title,
      itemName: need.catalogItem.name,
      unit: need.catalogItem.unit,
      ngoId: need.ngoId,
      ngoName: need.ngo.name,
      vendorName: need.vendor.name,
      vendorEmail: need.vendor.paypalEmail,
      unitPriceCents: need.unitPriceCents,
      goodsCents,
      // PayPal's fixed fee applies to every purchase unit, so fee cover is per line.
      feeCents: coverFees ? feeCoverCents(goodsCents) : 0,
    };
  });

  const goodsCents = lines.reduce((s, l) => s + l.goodsCents, 0);
  const feeCents = lines.reduce((s, l) => s + l.feeCents, 0);
  return { lines, goodsCents, feeCents, totalCents: goodsCents + feeCents };
}

export interface StartCheckoutInput {
  items: BasketItem[];
  coverFees?: boolean;
  ngoShare?: { ngoId: number; cents: number };
  source?: "direct" | "agent";
  agentNote?: string;
  clubBasketId?: number;
  pot?: { id: number; note?: string };
}

export async function startCheckout({ items, coverFees = false, ngoShare, source = "direct", agentNote, clubBasketId, pot }: StartCheckoutInput) {
  const basket = await priceBasket(items, coverFees);
  if (pot) {
    const row = await db.query.pots.findFirst({ where: (p, { eq }) => eq(p.id, pot.id) });
    if (!row || items.length !== 1 || items[0].needId !== row.needId) throw new DonationError("This pot is for a different need");
  }

  const units: PurchaseUnit[] = basket.lines.map((l) => ({
    referenceId: `need_${l.needId}`,
    description: `${l.units} × ${l.itemName} for ${l.ngoName}`,
    amountCents: l.goodsCents + l.feeCents,
    payeeEmail: l.vendorEmail,
  }));

  let shareNgoId: number | null = null;
  let shareCents = 0;
  if (ngoShare && ngoShare.cents > 0) {
    if (!Number.isInteger(ngoShare.cents) || ngoShare.cents < MIN_NGO_SHARE_CENTS) {
      throw new DonationError(`The gift to the organisation must be at least $${MIN_NGO_SHARE_CENTS / 100}`);
    }
    if (!basket.lines.some((l) => l.ngoId === ngoShare.ngoId)) throw new DonationError("The gift must go to an NGO in this basket");
    const ngo = await db.query.ngos.findFirst({ where: (n, { eq }) => eq(n.id, ngoShare.ngoId) });
    if (!ngo) throw new DonationError("Unknown NGO");
    units.push({
      referenceId: "ngo_gift",
      description: `Unrestricted support for ${ngo.name}`,
      amountCents: ngoShare.cents,
      payeeEmail: ngo.paypalEmail,
    });
    shareNgoId = ngo.id;
    shareCents = ngoShare.cents;
  }

  const paypalOrderId = await createOrder(units, randomUUID());

  await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(schema.orders)
      .values({
        paypalOrderId,
        source,
        coverFees,
        ngoShareNgoId: shareNgoId,
        ngoShareCents: shareCents,
        agentNote,
        clubBasketId,
        potId: pot?.id,
        potNote: pot?.note?.trim().slice(0, 140) || null,
      })
      .returning();
    await tx.insert(schema.donations).values(
      basket.lines.map((l) => ({
        orderId: order.id,
        needId: l.needId,
        referenceId: `need_${l.needId}`,
        units: l.units,
        vendorAmountCents: l.goodsCents + l.feeCents,
        feeCoverCents: l.feeCents,
      })),
    );
  });

  return { orderId: paypalOrderId, basket, ngoShareCents: shareCents };
}

/** Capture an approved order and record every gift in it. Safe to call twice. */
export async function completeCheckout(paypalOrderId: string) {
  const order = await db.query.orders.findFirst({
    where: (o, { eq }) => eq(o.paypalOrderId, paypalOrderId),
    with: { donations: true },
  });
  if (!order) throw new DonationError("Unknown order");
  if (order.status === "captured") return order;

  const result = await captureOrder(paypalOrderId);
  const byRef = new Map(result.units.map((u) => [u.referenceId, u]));
  const allPaid = order.donations.every((d) => byRef.get(d.referenceId)?.status === "COMPLETED");
  if (result.status !== "COMPLETED" || !allPaid) {
    await db.update(schema.orders).set({ status: "failed" }).where(eq(schema.orders.id, order.id));
    throw new DonationError(`Payment was not completed (${result.status})`);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.orders)
      .set({
        status: "captured",
        ngoCaptureId: byRef.get("ngo_gift")?.captureId,
        donorName: result.payerName,
        donorEmail: result.payerEmail,
        capturedAt: new Date(),
      })
      .where(eq(schema.orders.id, order.id))
      .returning();
    for (const d of order.donations) {
      await tx
        .update(schema.donations)
        .set({ captured: true, captureId: byRef.get(d.referenceId)!.captureId })
        .where(eq(schema.donations.id, d.id));
      // Two donors can approve the last units at the same time; the vendor delivers what was
      // paid for, so funded units may exceed the target slightly rather than refusing a payment.
      await tx
        .update(schema.needs)
        .set({
          fundedUnits: sql`${schema.needs.fundedUnits} + ${d.units}`,
          status: sql`case when ${schema.needs.fundedUnits} + ${d.units} >= ${schema.needs.quantity} then 'funded'::need_status else ${schema.needs.status} end`,
        })
        .where(eq(schema.needs.id, d.needId));
    }
    if (order.clubBasketId) {
      await tx
        .update(schema.clubBaskets)
        .set({ status: "paid", paypalOrderId })
        .where(eq(schema.clubBaskets.id, order.clubBasketId));
    }
    return { ...updated, donations: order.donations };
  });
}
