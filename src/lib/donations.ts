// Donation flow: start (create PayPal order) → donor approves in PayPal → complete (capture).
// Amounts are always computed here from the database, never taken from the client.
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { feeCoverCents, MIN_NGO_SHARE_CENTS } from "./fees.ts";
import { captureOrder, createDonationOrder } from "./paypal.ts";

export class DonationError extends Error {}

export interface StartDonationInput {
  needId: number;
  units: number;
  ngoShareCents?: number;
  coverFees?: boolean;
}

export async function startDonation({ needId, units, ngoShareCents = 0, coverFees = false }: StartDonationInput) {
  if (!Number.isInteger(units) || units < 1) throw new DonationError("Choose at least one unit");
  if (!Number.isInteger(ngoShareCents) || ngoShareCents < 0) throw new DonationError("Invalid NGO share");
  if (ngoShareCents > 0 && ngoShareCents < MIN_NGO_SHARE_CENTS) {
    throw new DonationError(`The gift to the organisation must be at least $${MIN_NGO_SHARE_CENTS / 100}`);
  }

  const row = await db.query.needs.findFirst({
    where: (n, { eq }) => eq(n.id, needId),
    with: { vendor: true, ngo: true, catalogItem: true },
  });
  if (!row || row.status !== "open") throw new DonationError("This need is not open for donations");
  const remaining = row.quantity - row.fundedUnits;
  if (units > remaining) throw new DonationError(`Only ${remaining} left to fund`);

  const goodsCents = units * row.unitPriceCents;
  const feeCents = coverFees ? feeCoverCents(goodsCents) : 0;
  const orderId = await createDonationOrder({
    needId,
    description: `${units} × ${row.catalogItem.name} for ${row.ngo.name}`,
    vendorEmail: row.vendor.paypalEmail,
    vendorAmountCents: goodsCents + feeCents,
    ngoEmail: row.ngo.paypalEmail,
    ngoShareCents,
    requestId: randomUUID(),
  });

  await db.insert(schema.donations).values({
    needId,
    units,
    vendorAmountCents: goodsCents + feeCents,
    feeCoverCents: feeCents,
    ngoShareCents,
    coverFees,
    paypalOrderId: orderId,
  });
  return { orderId };
}

/** Capture an approved order and record it. Safe to call twice for the same order. */
export async function completeDonation(orderId: string) {
  const donation = await db.query.donations.findFirst({ where: (d, { eq }) => eq(d.paypalOrderId, orderId) });
  if (!donation) throw new DonationError("Unknown order");
  if (donation.status === "captured") return donation;

  const result = await captureOrder(orderId);
  const vendor = result.units.find((u) => u.referenceId === "vendor");
  const ngo = result.units.find((u) => u.referenceId === "ngo");
  if (result.status !== "COMPLETED" || vendor?.status !== "COMPLETED") {
    await db.update(schema.donations).set({ status: "failed" }).where(eq(schema.donations.id, donation.id));
    throw new DonationError(`Payment was not completed (${result.status})`);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.donations)
      .set({
        status: "captured",
        vendorCaptureId: vendor.captureId,
        ngoCaptureId: ngo?.captureId,
        donorName: result.payerName,
        donorEmail: result.payerEmail,
        capturedAt: new Date(),
      })
      .where(eq(schema.donations.id, donation.id))
      .returning();
    // Two donors can approve the last units at the same time; the vendor delivers what was paid for,
    // so funded units may exceed the target slightly rather than refusing a completed payment.
    await tx
      .update(schema.needs)
      .set({
        fundedUnits: sql`${schema.needs.fundedUnits} + ${donation.units}`,
        status: sql`case when ${schema.needs.fundedUnits} + ${donation.units} >= ${schema.needs.quantity} then 'funded'::need_status else ${schema.needs.status} end`,
      })
      .where(eq(schema.needs.id, donation.needId));
    return updated;
  });
}
