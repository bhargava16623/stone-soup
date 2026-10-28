// Spike: is Channel3's median price a usable benchmark for typical relief items?
// Run: npm run spike:channel3 -- ["custom query" ...]
import "./env.mjs";
import { benchmarkPrice, checkFairPrice } from "../../src/lib/channel3.ts";
import { geminiRelevanceFilter } from "../../src/lib/relevance.ts";

// --raw skips the Gemini relevance filter to compare against plain Channel3 results.
const raw = process.argv.includes("--raw");
const args = process.argv.slice(2).filter((a) => a !== "--raw");

// [query, example vendor unit price] — vendor prices are made up to exercise the check.
const cases: [string, number][] = args.length
  ? args.map((q) => [q, NaN])
  : [
      ["fleece blanket, twin size", 18],
      ["fleece blanket, twin size", 35],
      ["white rice, 25 lb bag", 22],
      ["kids school backpack", 20],
      ["toothbrush and toothpaste travel kit", 12],
      ["adult sleeping bag", 40],
    ];

for (const [query, vendorPrice] of cases) {
  const started = Date.now();
  try {
    const b = await benchmarkPrice(query, { filterRelevant: raw ? undefined : geminiRelevanceFilter });
    const ms = Date.now() - started;
    if (!b) {
      console.log(`\n"${query}" → too few priced results (${ms} ms)`);
      continue;
    }
    console.log(
      `\n"${query}" → median $${b.median.toFixed(2)} (IQR $${b.low.toFixed(2)}–$${b.high.toFixed(2)}, n=${b.sampleSize}, ${ms} ms)`,
    );
    for (const s of b.samples.slice(0, 5)) console.log(`   $${s.price.toFixed(2).padStart(7)}  ${s.domain.padEnd(22)} ${s.title.slice(0, 60)}`);
    if (!Number.isNaN(vendorPrice)) {
      const c = checkFairPrice(vendorPrice, b);
      const pct = c.diffPct === undefined ? "" : ` (${c.diffPct >= 0 ? "+" : ""}${(c.diffPct * 100).toFixed(0)}% vs market)`;
      console.log(`   vendor $${vendorPrice} → ${c.verdict}${pct}${c.needsJustification ? " — NGO must justify" : ""}`);
    }
  } catch (e) {
    console.log(`\n"${query}" → ❌ ${(e as Error).message}`);
  }
}
