// Shared Pot: someone starts a pot for one need and shares the link; each friend pays their own
// units through PayPal (straight to the supplier, as always) and appears on the pot page.
import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";

export class PotError extends Error {}

export async function createPot(input: { needId: number; title: string; organizerName: string; goalUnits: number }) {
  const need = await db.query.needs.findFirst({ where: (n, { eq }) => eq(n.id, input.needId) });
  if (!need || need.status !== "open") throw new PotError("This need isn't open any more");
  const remaining = need.quantity - need.fundedUnits;
  const title = input.title.trim().slice(0, 80);
  const organizerName = input.organizerName.trim().slice(0, 40);
  if (!title) throw new PotError("Give your pot a name");
  if (!organizerName) throw new PotError("Tell us your first name");
  if (!Number.isInteger(input.goalUnits) || input.goalUnits < 1 || input.goalUnits > remaining) {
    throw new PotError(`Choose a goal between 1 and ${remaining}`);
  }
  const [pot] = await db
    .insert(schema.pots)
    .values({ slug: randomBytes(6).toString("base64url"), needId: need.id, title, organizerName, goalUnits: input.goalUnits })
    .returning();
  return pot;
}

/** Pot with its need and every paid contribution (newest first). */
export async function getPot(slug: string) {
  const pot = await db.query.pots.findFirst({
    where: (p, { eq }) => eq(p.slug, slug),
    with: { need: { with: { ngo: true, vendor: true, catalogItem: true } } },
  });
  if (!pot) return undefined;
  const contributions = await db
    .select({
      units: schema.donations.units,
      donorName: schema.orders.donorName,
      note: schema.orders.potNote,
      at: schema.orders.capturedAt,
    })
    .from(schema.donations)
    .innerJoin(schema.orders, eq(schema.donations.orderId, schema.orders.id))
    .where(and(eq(schema.orders.potId, pot.id), eq(schema.donations.captured, true), eq(schema.donations.needId, pot.needId)))
    .orderBy(desc(schema.orders.capturedAt));
  const raisedUnits = contributions.reduce((s, c) => s + c.units, 0);
  return { ...pot, contributions, raisedUnits };
}

export type PotWithProgress = NonNullable<Awaited<ReturnType<typeof getPot>>>;

/** Pots started for a need, for the need page. */
export async function getPotsForNeed(needId: number) {
  return db.query.pots.findMany({ where: (p, { eq }) => eq(p.needId, needId), orderBy: (p) => [desc(p.createdAt)], limit: 5 });
}
