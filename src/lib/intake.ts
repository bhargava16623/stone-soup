// NGO intake: plain-language request → Gemini → structured needs matched to vendor catalogs.
// The NGO never types a price; each option carries the vendor's price and its market check.
import "server-only";
import { Type } from "@google/genai";
import { db, schema } from "@/db/index.ts";
import type { Need } from "@/db/schema.ts";
import { checkVendorPrice } from "./benchmark.ts";
import { generateJson } from "./gemini.ts";
import { canPostNeeds } from "./verify.ts";

export interface VendorOption {
  catalogItemId: number;
  vendorName: string;
  vendorCity: string;
  trustScore: number;
  itemName: string;
  unit: string;
  unitPriceCents: number;
  marketMedianCents: number | null;
  verdict: Need["fairPrice"];
  diffPct: number | null;
}

export interface NeedDraft {
  key: string;
  title: string;
  story: string;
  requestedItem: string;
  quantity: number;
  quantityNote: string | null; // how Gemini worked out the quantity, shown to the NGO
  seen: string | null; // for photo intake: what in the photo shows the item is running low
  urgency: Need["urgency"];
  deadline: string | null;
  options: VendorOption[]; // cheapest acceptable first; empty when no vendor sells it
  selectedCatalogItemId: number | null;
}

interface Extracted {
  needs: {
    title: string;
    story: string;
    item: string;
    quantityReasoning: string;
    seen?: string;
    neededAmount?: number;
    measure?: string;
    unitSize?: number;
    quantity: number;
    urgency: "low" | "medium" | "high";
    deadline: string | null;
    matchingCatalogIds: number[];
  }[];
}

const SYSTEM = `You help a small charity turn a plain-language request into separate, specific needs.
For each distinct item:
- title: short, concrete, starts with the quantity (e.g. "40 fleece blankets for winter nights")
- story: one or two sentences in the charity's voice about why it's needed, using only what they said
- item: the concrete product, e.g. "fleece blanket, twin size"
- quantityReasoning: if they did not give a plain count of the item, one short line of arithmetic showing how
  you got the quantity in units of the matching catalog item, using realistic amounts. Example: "30 people ×
  14 days × 0.2 lb dry rice per day = 84 lb ÷ 25 lb per bag → 4 bags". Assume one serving per person per day
  unless they say otherwise. Empty string when they gave a direct count.
- quantity: whole number of units, the result of that arithmetic (or the count they gave)
- urgency: high if they say urgent/asap/this week or give a deadline within 7 days; low if no time pressure
- deadline: ISO date (YYYY-MM-DD) if they give one, resolved against today's date; otherwise null
- matchingCatalogIds: ids from the vendor catalog that are the same type of product. Empty if none fit.
Never invent items they did not ask for.`;

const needsSchema = (fromPhoto: boolean) => ({
  type: Type.OBJECT,
  properties: {
    ...(fromPhoto ? { photoSummary: { type: Type.STRING }, looksLikeStorage: { type: Type.BOOLEAN } } : {}),
    needs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          story: { type: Type.STRING },
          item: { type: Type.STRING },
          quantityReasoning: { type: Type.STRING },
          ...(fromPhoto
            ? { seen: { type: Type.STRING }, neededAmount: { type: Type.NUMBER }, measure: { type: Type.STRING }, unitSize: { type: Type.NUMBER } }
            : {}),
          quantity: { type: Type.INTEGER },
          urgency: { type: Type.STRING, enum: ["low", "medium", "high"] },
          deadline: { type: Type.STRING, nullable: true },
          matchingCatalogIds: { type: Type.ARRAY, items: { type: Type.INTEGER } },
        },
        required: [
          "title",
          "story",
          "item",
          "quantityReasoning",
          ...(fromPhoto ? ["seen", "neededAmount", "measure", "unitSize"] : ["quantity"]),
          "urgency",
          "deadline",
          "matchingCatalogIds",
        ],
      },
    },
  },
  required: fromPhoto ? ["photoSummary", "looksLikeStorage", "needs"] : ["needs"],
});

const PHOTO_SYSTEM = `You help a small charity restock. You get a photo of their storeroom, pantry, closet or supply
shelf, and sometimes a short note (how many people they serve, for how long).
Work out what is running low or missing. Only propose items you have visual evidence for: empty or nearly empty
shelves, labelled bins or shelf tags with little left, obvious gaps among similar items. Do not invent needs for
things not suggested by the photo.
- photoSummary: one sentence describing what the photo shows
- looksLikeStorage: false if the photo is not a storage space or supplies (then return no needs)
For each item that is low:
- seen: one short sentence on what in the photo shows it is low, e.g. "Shelf labelled BLANKETS holds 2 folded blankets"
- title: short and concrete, plural, WITHOUT a number; we add the quantity in front
  (e.g. "fleece blankets to restock the linen shelf", "bags of rice (25 lb) for the pantry")
- story: one or two sentences in the charity's voice, based on the photo and the note
- item: the concrete product, e.g. "fleece blanket, twin size"
- neededAmount, measure, quantityReasoning: how much is needed in a natural measure ("lb", "blankets", "kits"),
  and one short line of arithmetic that produces it. Use the note (people × days) when given, with realistic
  amounts per person (one person eats about 0.2 lb of dry rice a day; one blanket or sleeping bag per bed; one
  hygiene kit per person a month), e.g. "30 people × 14 days × 0.2 lb dry rice per day = 84 lb" or
  "40 beds × 1 blanket − 6 on the shelf = 34 blankets". Without a note, estimate the visible shelf capacity
  minus what is there. Do not divide into packs; we do that.
- unitSize: how much of that measure one unit of the matching catalog item holds (25 for a 25 lb bag of rice
  measured in lb; 1 when the measure is the item itself)
- urgency: high if the shelf is empty or nearly empty, medium if low, low otherwise
- deadline: null unless the note gives a date (YYYY-MM-DD, resolved against today's date)
- matchingCatalogIds: ids from the vendor catalog that are the same type of product. Empty if none fit.
At most 6 items, the emptiest first.`;

async function activeCatalog() {
  const catalog = await db.query.catalogItems.findMany({
    where: (c, { eq }) => eq(c.active, true),
    with: { vendor: true },
  });
  const text = catalog.map((c) => `id ${c.id}: ${c.name} — ${c.spec} (per ${c.unit})`).join("\n");
  return { catalog, text };
}

export async function draftNeeds(request: string): Promise<NeedDraft[]> {
  const text = request.trim();
  if (text.length < 5) throw new Error("Describe what you need");
  if (text.length > 2000) throw new Error("Please keep it under 2,000 characters");

  const { catalog, text: catalogText } = await activeCatalog();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await generateJson<Extracted>(
    `Today is ${today}.\n\nVendor catalog:\n${catalogText}\n\nThe charity wrote:\n"""${text}"""`,
    needsSchema(false),
    { system: SYSTEM },
  );
  return toDrafts(data, catalog);
}

export interface PhotoDraft {
  summary: string;
  looksLikeStorage: boolean;
  drafts: NeedDraft[];
}

/** "Snap the shelf": a photo of a storeroom becomes restock needs matched to vendor catalogs. */
export async function draftNeedsFromPhoto(imageBase64: string, mimeType: string, note: string): Promise<PhotoDraft> {
  if (note.length > 500) throw new Error("Please keep the note under 500 characters");
  const { catalog, text: catalogText } = await activeCatalog();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await generateJson<Extracted & { photoSummary: string; looksLikeStorage: boolean }>(
    [
      { inlineData: { data: imageBase64, mimeType } },
      {
        text: `Today is ${today}.\n\nVendor catalog:\n${catalogText}\n\n${
          note.trim() ? `The charity's note:\n"""${note.trim()}"""` : "No note was given."
        }`,
      },
    ],
    needsSchema(true),
    { system: PHOTO_SYSTEM },
  );
  // Gemini works out the amount; the division into catalog units is done here, where it can't slip.
  for (const n of data.needs) {
    const size = n.unitSize && n.unitSize > 0 ? n.unitSize : 1;
    n.quantity = Math.ceil((n.neededAmount ?? 0) / size - 1e-9);
    if (size !== 1) n.quantityReasoning = `${n.quantityReasoning.trim()} ÷ ${size} ${n.measure} each → ${n.quantity}`;
    // Drop a count the model put in front anyway (but keep sizes like "25 lb bags").
    const lead = Number(n.title.trim().match(/^([\d,.]+)\s/)?.[1]?.replace(/,/g, ""));
    const rest = lead === n.quantity || lead === n.neededAmount ? n.title.trim().replace(/^[\d,.]+\s*/, "") : n.title.trim();
    n.title = `${n.quantity} ${rest}`;
  }
  return {
    summary: data.photoSummary,
    looksLikeStorage: data.looksLikeStorage,
    drafts: data.looksLikeStorage ? toDrafts({ needs: data.needs.filter((n) => n.quantity > 0) }, catalog) : [],
  };
}

/**
 * Models sometimes slip on the last division ("84 lb ÷ 25 lb per bag → 42 bags"). Recompute it and
 * round up, so the quantity always matches the arithmetic shown to the charity.
 */
function checkArithmetic(reasoning: string, quantity: number): { reasoning: string; quantity: number } {
  const m = reasoning.match(/([\d,.]+)\s*[^\d÷]*÷\s*([\d,.]+)[^→]*→\s*(\d+)/);
  if (!m) return { reasoning, quantity };
  const [a, b, stated] = [m[1], m[2], m[3]].map((x) => Number(x.replace(/,/g, "")));
  if (!(a > 0 && b > 0)) return { reasoning, quantity };
  const correct = Math.ceil(a / b - 1e-9);
  if (correct === stated) return { reasoning, quantity };
  const fixed = reasoning.slice(0, m.index! + m[0].length - m[3].length) + correct + reasoning.slice(m.index! + m[0].length);
  return { reasoning: fixed, quantity: quantity === stated ? correct : quantity };
}

type CatalogWithVendor = Awaited<ReturnType<typeof activeCatalog>>["catalog"];

function toDrafts(data: Extracted, catalog: CatalogWithVendor): NeedDraft[] {
  return data.needs.slice(0, 8).map((n, i) => {
    const math = checkArithmetic(n.quantityReasoning.trim(), Math.round(n.quantity));
    const options = catalog
      .filter((c) => n.matchingCatalogIds.includes(c.id))
      .map((c): VendorOption => {
        const check = checkVendorPrice(c.unitPriceCents, c.benchmark ?? undefined);
        return {
          catalogItemId: c.id,
          vendorName: c.vendor.name,
          vendorCity: c.vendor.city,
          trustScore: c.vendor.trustScore,
          itemName: c.name,
          unit: c.unit,
          unitPriceCents: c.unitPriceCents,
          marketMedianCents: c.benchmark?.medianCents ?? null,
          verdict: check.verdict,
          diffPct: check.diffPct ?? null,
        };
      })
      // Fairly priced options first, then cheapest.
      .sort((a, b) => Number(a.verdict === "above_market") - Number(b.verdict === "above_market") || a.unitPriceCents - b.unitPriceCents);

    return {
      key: `${Date.now()}-${i}`,
      title: n.title,
      story: n.story,
      requestedItem: n.item,
      quantity: Math.max(1, Math.min(10_000, math.quantity)),
      quantityNote: math.reasoning || null,
      seen: n.seen?.trim() || null,
      urgency: n.urgency,
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(n.deadline ?? "") ? n.deadline : null,
      options,
      selectedCatalogItemId: options[0]?.catalogItemId ?? null,
    };
  });
}

export interface PublishInput {
  ngoId: number;
  catalogItemId: number;
  title: string;
  story: string;
  quantity: number;
  urgency: Need["urgency"];
  deadline: string | null;
  priceJustification?: string;
}

export async function publishNeed(input: PublishInput) {
  const ngo = await db.query.ngos.findFirst({ where: (n, { eq }) => eq(n.id, input.ngoId) });
  if (!ngo || !canPostNeeds(ngo.status)) throw new Error("Verify your charity before posting needs");
  const item = await db.query.catalogItems.findFirst({ where: (c, { eq }) => eq(c.id, input.catalogItemId) });
  if (!item || !item.active) throw new Error("That vendor item is no longer available");
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("Quantity must be at least 1");
  const title = input.title.trim();
  if (!title) throw new Error("Give the need a title");

  const check = checkVendorPrice(item.unitPriceCents, item.benchmark ?? undefined);
  const justification = input.priceJustification?.trim() || null;
  if (check.needsJustification && !justification) {
    throw new Error(
      check.verdict === "above_market"
        ? "This vendor is above the market price. Explain why, or pick another vendor."
        : "There is no market price for this item. Add a short note on why the price is fair.",
    );
  }

  const [need] = await db
    .insert(schema.needs)
    .values({
      ngoId: input.ngoId,
      vendorId: item.vendorId,
      catalogItemId: item.id,
      title,
      story: input.story.trim() || null,
      quantity: input.quantity,
      unitPriceCents: item.unitPriceCents,
      urgency: input.urgency,
      deadline: input.deadline,
      benchmark: item.benchmark,
      fairPrice: check.verdict,
      priceJustification: justification,
      imageUrl: item.imageUrl,
    })
    .returning();
  return need;
}
