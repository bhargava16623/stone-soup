// Market benchmark stored on a need. Search results vary between runs, so the
// comparison products are chosen once and saved by ID; re-pricing looks up the
// same products again (free on Channel3) instead of running a new search.
import type { Channel3Api } from "@channel3/sdk";
import type { Benchmark } from "@/db/schema.ts";
import { benchmarkPrice, channel3, checkFairPrice, type FairPriceCheck, type PriceBenchmark } from "./channel3.ts";
import { geminiRelevanceFilter } from "./relevance.ts";

/** How many comparison products to keep (closest to the median). */
const BASKET_SIZE = 10;

const cents = (dollars: number) => Math.round(dollars * 100);

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function quartile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)))];
}

function summarise(query: string, currency: string, products: Benchmark["products"]): Benchmark {
  const prices = products.map((p) => p.priceCents).sort((a, b) => a - b);
  return {
    query,
    currency,
    medianCents: median(prices),
    lowCents: quartile(prices, 0.25),
    highCents: quartile(prices, 0.75),
    products,
    checkedAt: new Date().toISOString(),
  };
}

function toBasket(b: PriceBenchmark): Benchmark["products"] {
  return [...b.samples]
    .sort((x, y) => Math.abs(x.price - b.median) - Math.abs(y.price - b.median))
    .slice(0, BASKET_SIZE)
    .map((s) => ({ id: s.productId, title: s.title, priceCents: cents(s.price), domain: s.domain, imageUrl: s.imageUrl }))
    .sort((x, y) => x.priceCents - y.priceCents);
}

/** Search the market once for an item spec and save the comparison basket. */
export async function createBenchmark(spec: string): Promise<Benchmark | undefined> {
  const found = await benchmarkPrice(spec, { filterRelevant: geminiRelevanceFilter });
  return found ? summarise(spec, found.currency, toBasket(found)) : undefined;
}

/** Re-price the saved basket with current offers. Products that disappeared are dropped. */
export async function repriceBenchmark(b: Benchmark): Promise<Benchmark | undefined> {
  const refreshed = await Promise.all(
    b.products.map(async (p) => {
      try {
        const product = await channel3().products.retrieve({ product_id: p.id, currency: b.currency as Channel3Api.CurrencyCode });
        const prices = (product.offers ?? [])
          .filter((o) => o.availability === "InStock" && o.price?.price > 0)
          .map((o) => o.price.price);
        return prices.length ? { ...p, priceCents: cents(Math.min(...prices)) } : undefined;
      } catch {
        return undefined;
      }
    }),
  );
  const products = refreshed.filter((p) => p !== undefined);
  return products.length >= 3 ? summarise(b.query, b.currency, products) : undefined;
}

/** Fair-price verdict for a vendor price (cents) against a saved benchmark. */
export function checkVendorPrice(vendorPriceCents: number, b: Benchmark | undefined): FairPriceCheck {
  if (!b) return checkFairPrice(vendorPriceCents / 100, undefined);
  return checkFairPrice(vendorPriceCents / 100, {
    query: b.query,
    currency: b.currency,
    median: b.medianCents / 100,
    low: b.lowCents / 100,
    high: b.highCents / 100,
    sampleSize: b.products.length,
    samples: [],
  });
}
