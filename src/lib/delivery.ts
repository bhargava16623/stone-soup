// Delivery confirmation: the NGO uploads a photo of what arrived; Gemini checks it against
// the order; verified deliveries trigger a personal impact update for each donor.
// Flagged deliveries are never rejected automatically — they wait for a person to review.
import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Type } from "@google/genai";
import { db, schema } from "@/db/index.ts";
import type { DeliveryCheck } from "@/db/schema.ts";
import { generateJson } from "./gemini.ts";
import { hashDistance, inspectPhoto, PhotoError, SAME_PHOTO_DISTANCE } from "./photos.ts";

export class DeliveryError extends Error {}

interface VisionResult extends DeliveryCheck {
  summary: string;
}

const VISION_PROMPT = (item: string, spec: string, units: number) => `A small charity says this photo shows a delivery
they just received: ${units} × ${item} (${spec}). You are checking it for donors.
- matchesItem: does the photo show this kind of item?
- estimatedQuantity: roughly how many units are visible (null if you can't tell, e.g. still in boxes)
- looksAuthentic: false if it looks like a stock photo, a screenshot, a product listing, or AI-generated
- concerns: short phrases for anything a donor should know (empty if none)
- summary: one plain sentence describing what the photo shows, for the donor (no people's identities)`;

async function checkPhoto(base64: string, mimeType: string, item: string, spec: string, units: number): Promise<VisionResult> {
  const { data } = await generateJson<VisionResult>(
    [{ inlineData: { data: base64, mimeType } }, { text: VISION_PROMPT(item, spec, units) }],
    {
      type: Type.OBJECT,
      properties: {
        matchesItem: { type: Type.BOOLEAN },
        estimatedQuantity: { type: Type.INTEGER, nullable: true },
        looksAuthentic: { type: Type.BOOLEAN },
        concerns: { type: Type.ARRAY, items: { type: Type.STRING } },
        summary: { type: Type.STRING },
      },
      required: ["matchesItem", "estimatedQuantity", "looksAuthentic", "concerns", "summary"],
    },
  );
  return data;
}

export interface ConfirmDeliveryInput {
  ngoId: number;
  needId: number;
  units: number;
  note?: string;
  photoBase64: string;
  photoMime: string;
}

export async function confirmDelivery(input: ConfirmDeliveryInput) {
  const need = await db.query.needs.findFirst({
    where: (n, { eq }) => eq(n.id, input.needId),
    with: { catalogItem: true, vendor: true, ngo: true },
  });
  if (!need || need.ngoId !== input.ngoId) throw new DeliveryError("This need doesn't belong to your organisation");
  const outstanding = need.fundedUnits - need.deliveredUnits;
  if (!Number.isInteger(input.units) || input.units < 1 || input.units > outstanding) {
    throw new DeliveryError(`You can confirm between 1 and ${outstanding} ${need.catalogItem.unit}s`);
  }

  const photo = Buffer.from(input.photoBase64, "base64");
  let checked: Awaited<ReturnType<typeof inspectPhoto>>;
  try {
    checked = await inspectPhoto(photo);
  } catch (e) {
    throw e instanceof PhotoError ? new DeliveryError(e.message) : e;
  }
  const photoHash = createHash("sha256").update(photo).digest("hex");
  const exact = await db.query.deliveries.findFirst({ where: (d, { eq }) => eq(d.photoHash, photoHash), columns: { id: true } });
  // Also catch the same picture re-saved, resized or lightly cropped.
  const earlier = exact
    ? []
    : await db.query.deliveries.findMany({ where: (d, { isNotNull }) => isNotNull(d.photoDhash), columns: { photoDhash: true } });
  const similar = earlier.some((d) => hashDistance(d.photoDhash!, checked.dhash) <= SAME_PHOTO_DISTANCE);
  const reused = Boolean(exact) || similar;

  const vision = await checkPhoto(input.photoBase64, checked.mime, need.catalogItem.name, need.catalogItem.spec, input.units);
  const concerns = [...vision.concerns];
  if (exact) concerns.unshift("This exact photo was already used for another delivery");
  else if (similar) concerns.unshift("This looks like the same photo as an earlier delivery");
  const verified = !reused && vision.matchesItem && vision.looksAuthentic;

  return db.transaction(async (tx) => {
    const [delivery] = await tx
      .insert(schema.deliveries)
      .values({
        needId: need.id,
        units: input.units,
        note: input.note?.trim().slice(0, 500) || null,
        photo,
        photoMime: checked.mime,
        photoHash,
        photoDhash: checked.dhash,
        verdict: verified ? "verified" : "flagged",
        aiSummary: vision.summary,
        aiCheck: {
          matchesItem: vision.matchesItem,
          estimatedQuantity: vision.estimatedQuantity,
          looksAuthentic: vision.looksAuthentic,
          concerns,
        },
      })
      .returning({ id: schema.deliveries.id, verdict: schema.deliveries.verdict });
    if (verified) await applyVerifiedDelivery(tx, need.id, input.units);
    return { ...delivery, summary: vision.summary, concerns };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function applyVerifiedDelivery(tx: Tx, needId: number, units: number) {
  await tx
    .update(schema.needs)
    .set({
      deliveredUnits: sql`${schema.needs.deliveredUnits} + ${units}`,
      // Fully funded and fully delivered → verified; otherwise a partial delivery keeps it open/funded.
      status: sql`case when ${schema.needs.status} = 'funded' and ${schema.needs.deliveredUnits} + ${units} >= ${schema.needs.fundedUnits}
        then 'verified'::need_status else ${schema.needs.status} end`,
    })
    .where(eq(schema.needs.id, needId));
}

/** A person reviewed a flagged delivery and accepted it. */
export async function approveFlaggedDelivery(deliveryId: number) {
  return db.transaction(async (tx) => {
    const [d] = await tx
      .update(schema.deliveries)
      .set({ verdict: "verified" })
      .where(and(eq(schema.deliveries.id, deliveryId), eq(schema.deliveries.verdict, "flagged")))
      .returning();
    if (!d) throw new DeliveryError("Delivery not found or not flagged");
    await applyVerifiedDelivery(tx, d.needId, d.units);
    return d;
  });
}

const IMPACT_SYSTEM = `Write a short, warm, specific update (2–3 sentences) for each donor whose gift was just delivered.
Use only the facts given: their first name, what they funded, the organisation, the supplier, the delivery day,
what the photo shows and the organisation's note. Describe the photo naturally; never mention checks, reviews,
stock photos or concerns. No exaggeration, no invented details about people, no emojis. Address them by first name.`;

/**
 * Write a personal update for each donor whose units have now been delivered. Delivered units are
 * allocated to donations in the order they were made, so a donor hears back only once their own
 * units have arrived.
 */
export async function writeImpactUpdates(deliveryId: number) {
  const delivery = await db.query.deliveries.findFirst({
    where: (d, { eq }) => eq(d.id, deliveryId),
    with: { need: { with: { ngo: true, vendor: true, catalogItem: true } } },
  });
  if (!delivery || delivery.verdict !== "verified") return [];
  const { need } = delivery;

  const captured = await db.query.donations.findMany({
    where: (d) => and(eq(d.needId, need.id), eq(d.captured, true)),
    orderBy: (d, { asc }) => [asc(d.id)],
    with: { order: true },
  });
  let fundedSoFar = 0;
  const delivered = captured.filter((d) => (fundedSoFar += d.units) <= need.deliveredUnits);

  const alreadyUpdated = await db
    .select({ id: schema.impactUpdates.donationId })
    .from(schema.impactUpdates)
    .where(inArray(schema.impactUpdates.donationId, delivered.length ? delivered.map((d) => d.id) : [0]));
  const pending = delivered.filter((d) => !alreadyUpdated.some((u) => u.id === d.id)).slice(0, 50);
  if (pending.length === 0) return [];

  const facts = {
    organisation: need.ngo.name,
    supplier: need.vendor.name,
    item: need.catalogItem.name,
    unit: need.catalogItem.unit,
    delivered_on: delivery.createdAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    photo_shows: delivery.aiSummary,
    organisation_note: delivery.note,
    donors: pending.map((d) => ({
      donation_id: d.id,
      first_name: d.order.donorName?.split(" ")[0] ?? "there",
      units_funded: d.units,
    })),
  };

  const { data } = await generateJson<{ updates: { donation_id: number; message: string }[] }>(
    JSON.stringify(facts),
    {
      type: Type.OBJECT,
      properties: {
        updates: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { donation_id: { type: Type.INTEGER }, message: { type: Type.STRING } },
            required: ["donation_id", "message"],
          },
        },
      },
      required: ["updates"],
    },
    { system: IMPACT_SYSTEM },
  );

  const valid = data.updates.filter((u) => pending.some((d) => d.id === u.donation_id) && u.message.trim());
  if (valid.length === 0) return [];
  return db
    .insert(schema.impactUpdates)
    .values(valid.map((u) => ({ donationId: u.donation_id, deliveryId: delivery.id, message: u.message.trim().slice(0, 1000) })))
    .returning();
}

/** Deliveries awaiting a human decision. */
export async function getFlaggedDeliveries() {
  return db.query.deliveries.findMany({
    where: (d, { eq }) => eq(d.verdict, "flagged"),
    columns: { photo: false },
    with: { need: { with: { ngo: true, catalogItem: true } } },
  });
}
