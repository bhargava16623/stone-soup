// Channel3 integration: market-price benchmark for Need Card items.
//
// The NGO never types a price — the donor pays the vendor's catalog price. Channel3
// gives an independent market reference so we can show a "fair price" badge and
// block inflated vendor prices before a Need Card goes live.
//
// The API key is read from CHANNEL3_API_KEY and must only be used server-side.
import { Channel3, type Channel3Api } from "@channel3/sdk";

let client: Channel3 | undefined;

function channel3(): Channel3 {
  if (!client) {
    const apiKey = process.env.CHANNEL3_API_KEY;
    if (!apiKey) throw new Error("CHANNEL3_API_KEY is not set");
    client = new Channel3({ apiKey });
  }
  return client;
}

export interface MarketSample {
  productId: string;
  title: string;
  price: number;
  domain: string;
  imageUrl?: string;
}

export interface PriceBenchmark {
  query: string;
  currency: string;
  median: number;
  low: number; // 25th percentile
  high: number; // 75th percentile
  sampleSize: number;
  samples: MarketSample[]; // cheapest-first, outliers removed
  imageUrl?: string; // representative product image for the Need Card
}

/** Fair-price tolerance above the market median before a vendor price is blocked. */
export const FAIR_PRICE_TOLERANCE = 0.3;

const MIN_SAMPLES = 3;

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Cheapest in-stock new offer for a product, in the request currency. */
function toSample(product: Channel3Api.Product): MarketSample | undefined {
  const offers = (product.offers ?? []).filter((o) => o.availability === "InStock" && o.price?.price > 0);
  if (offers.length === 0) return undefined;
  const best = offers.reduce((a, b) => (b.price.price < a.price.price ? b : a));
  const image = product.images?.find((i) => i.is_main_image) ?? product.images?.[0];
  return {
    productId: product.id,
    title: product.title,
    price: best.price.price,
    domain: best.domain,
    imageUrl: image?.cleaned_url ?? image?.url,
  };
}

/** Optional relevance pass (e.g. Gemini) that drops results that aren't the requested item. */
export type RelevanceFilter = (item: string, samples: MarketSample[]) => Promise<MarketSample[]>;

/**
 * Look up the market price for one unit of an item, e.g. "fleece blanket, twin size".
 * Returns undefined when Channel3 has too few relevant priced results to be meaningful
 * (common for groceries and local-only goods) — the caller treats that as "no benchmark".
 *
 * Uses agentic search mode (~2–5 s): in testing, default mode returned rice
 * cereal for "rice" and its median was pulled up by premium products, while agentic
 * mode with budget wording landed on comparable everyday items. Call this when a Need
 * Card is created and store the result on the card, not on every page view.
 */
export async function benchmarkPrice(
  item: string,
  {
    currency = "USD",
    limit = 30,
    filterRelevant,
  }: { currency?: string; limit?: number; filterRelevant?: RelevanceFilter } = {},
): Promise<PriceBenchmark | undefined> {
  const page = await channel3().products.search({
    // Neutral budget wording only: words like "charity" or "donation" leak into results.
    query: `${item}. Basic, budget-friendly, everyday version; single unit.`,
    limit,
    filters: { conditions: ["new"], availability: ["InStock"] },
    config: { mode: "agentic", currency },
  });

  let samples = page.data.map(toSample).filter((s): s is MarketSample => s !== undefined);
  if (filterRelevant) samples = await filterRelevant(item, samples);
  if (samples.length < MIN_SAMPLES) return undefined;

  // Drop outliers (bulk packs, accessories, luxury versions) with the IQR rule.
  const prices = samples.map((s) => s.price).sort((a, b) => a - b);
  const q1 = quantile(prices, 0.25);
  const q3 = quantile(prices, 0.75);
  const fence = 1.5 * (q3 - q1);
  const kept = samples
    .filter((s) => s.price >= q1 - fence && s.price <= q3 + fence)
    .sort((a, b) => a.price - b.price);
  const keptPrices = kept.map((s) => s.price);

  return {
    query: item,
    currency,
    median: quantile(keptPrices, 0.5),
    low: quantile(keptPrices, 0.25),
    high: quantile(keptPrices, 0.75),
    sampleSize: kept.length,
    samples: kept,
    imageUrl: kept.find((s) => s.imageUrl)?.imageUrl,
  };
}

export type FairPriceVerdict = "fair" | "below_market" | "above_market" | "no_benchmark";

export interface FairPriceCheck {
  verdict: FairPriceVerdict;
  vendorPrice: number;
  marketMedian?: number;
  diffPct?: number; // +0.25 = vendor is 25% above market
  needsJustification: boolean; // NGO must give a reason before publishing
}

/** Compare a vendor's unit price to the market benchmark. */
export function checkFairPrice(
  vendorPrice: number,
  benchmark: PriceBenchmark | undefined,
  tolerance = FAIR_PRICE_TOLERANCE,
): FairPriceCheck {
  // No market data (niche or local-only item): allow, but ask the NGO to explain.
  if (!benchmark) return { verdict: "no_benchmark", vendorPrice, needsJustification: true };

  const diffPct = (vendorPrice - benchmark.median) / benchmark.median;
  const verdict = diffPct > tolerance ? "above_market" : diffPct < -0.5 ? "below_market" : "fair";
  return {
    verdict,
    vendorPrice,
    marketMedian: benchmark.median,
    diffPct,
    needsJustification: verdict === "above_market",
  };
}
