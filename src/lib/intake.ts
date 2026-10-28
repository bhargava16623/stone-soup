// NGO intake: plain-language request → Gemini → structured needs matched to vendor catalogs.
// The NGO never types a price; each option carries the vendor's price and its market check.
import "server-only";
import { Type } from "@google/genai";
import { db, schema } from "@/db/index.ts";
import type { Need } from "@/db/schema.ts";
import { checkVendorPrice } from "./benchmark.ts";
import { generateJson } from "./gemini.ts";

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

const schemaDef = {
  type: Type.OBJECT,
  properties: {
    needs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          story: { type: Type.STRING },
          item: { type: Type.STRING },
          quantityReasoning: { type: Type.STRING },
          quantity: { type: Type.INTEGER },
          urgency: { type: Type.STRING, enum: ["low", "medium", "high"] },
          deadline: { type: Type.STRING, nullable: true },
          matchingCatalogIds: { type: Type.ARRAY, items: { type: Type.INTEGER } },
        },
        required: ["title", "story", "item", "quantityReasoning", "quantity", "urgency", "deadline", "matchingCatalogIds"],
      },
    },
  },
  required: ["needs"],
};

export async function draftNeeds(request: string): Promise<NeedDraft[]> {
  const text = request.trim();
  if (text.length < 5) throw new Error("Describe what you need");
  if (text.length > 2000) throw new Error("Please keep it under 2,000 characters");

  const catalog = await db.query.catalogItems.findMany({
    where: (c, { eq }) => eq(c.active, true),
    with: { vendor: true },
  });
  const catalogText = catalog.map((c) => `id ${c.id}: ${c.name} — ${c.spec} (per ${c.unit})`).join("\n");
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await generateJson<Extracted>(
    `Today is ${today}.\n\nVendor catalog:\n${catalogText}\n\nThe charity wrote:\n"""${text}"""`,
    schemaDef,
    { system: SYSTEM },
  );

  return data.needs.slice(0, 8).map((n, i) => {
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
      quantity: Math.max(1, Math.min(10_000, Math.round(n.quantity))),
      quantityNote: n.quantityReasoning.trim() || null,
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
