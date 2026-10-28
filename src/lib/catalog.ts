// Vendor catalogs: items are added by hand or read from a photo of a price list,
// and each one gets a market benchmark when it's added.
import "server-only";
import { Type } from "@google/genai";
import { db, schema } from "@/db/index.ts";
import { checkVendorPrice, createBenchmark } from "./benchmark.ts";
import { generateJson } from "./gemini.ts";

export interface CatalogEntry {
  name: string;
  spec: string;
  unit: string;
  unitPriceCents: number;
}

const PRICE_LIST_PROMPT = `This is a photo of a supplier's price list. Extract every product line you can read.
For each: name (short, as written), spec (a concrete description good for comparing prices online, e.g.
"fleece blanket, twin size"), unit (what one price buys, as a singular noun such as "blanket", "pair", "pack", "case"; never abbreviations
like "ea" or "pr"), and
unitPriceCents (the price in US cents as an integer). Skip lines without a readable price. Do not guess prices.`;

export async function readPriceList(imageBase64: string, mimeType: string): Promise<CatalogEntry[]> {
  const { data } = await generateJson<{ items: CatalogEntry[] }>(
    [{ inlineData: { data: imageBase64, mimeType } }, { text: PRICE_LIST_PROMPT }],
    {
      type: Type.OBJECT,
      properties: {
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              spec: { type: Type.STRING },
              unit: { type: Type.STRING },
              unitPriceCents: { type: Type.INTEGER },
            },
            required: ["name", "spec", "unit", "unitPriceCents"],
          },
        },
      },
      required: ["items"],
    },
  );
  return data.items.filter((i) => i.name && i.unitPriceCents > 0).slice(0, 25);
}

function validate(entry: CatalogEntry): CatalogEntry {
  const clean = {
    name: entry.name.trim(),
    spec: entry.spec.trim() || entry.name.trim(),
    unit: entry.unit.trim() || "unit",
    unitPriceCents: Math.round(entry.unitPriceCents),
  };
  if (!clean.name) throw new Error("Every item needs a name");
  if (!Number.isInteger(clean.unitPriceCents) || clean.unitPriceCents < 1 || clean.unitPriceCents > 1_000_000) {
    throw new Error(`Check the price for "${clean.name}"`);
  }
  return clean;
}

/** Add items to a vendor's catalog, benchmarking each against the market (in parallel). */
export async function addCatalogItems(vendorId: number, entries: CatalogEntry[]) {
  if (entries.length === 0) throw new Error("Nothing to add");
  const clean = entries.map(validate);
  const withBenchmarks = await Promise.all(
    clean.map(async (e) => {
      const benchmark = await createBenchmark(e.spec).catch((err) => {
        console.error(`benchmark failed for "${e.spec}"`, err);
        return undefined;
      });
      return {
        ...e,
        vendorId,
        benchmark,
        imageUrl: benchmark?.products.find((p) => p.imageUrl)?.imageUrl ?? null,
      };
    }),
  );
  const rows = await db.insert(schema.catalogItems).values(withBenchmarks).returning();
  return rows.map((r) => ({ ...r, check: checkVendorPrice(r.unitPriceCents, r.benchmark ?? undefined) }));
}
