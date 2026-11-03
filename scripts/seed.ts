// Seeds demo NGOs, vendors, catalogs and needs. Wipes existing data first.
// Market benchmarks are fetched live (Channel3 + Gemini, ~10 s per need);
// pass --no-benchmark for a fast seed without them.
// Run: npm run db:seed [-- --no-benchmark]
import { sql } from "drizzle-orm";
import { db, schema } from "../src/db/index.ts";
import { checkVendorPrice, createBenchmark } from "../src/lib/benchmark.ts";

const skipBenchmark = process.argv.includes("--no-benchmark");
const vendorEmail = process.env.SANDBOX_VENDOR_EMAIL;
const ngoEmail = process.env.SANDBOX_NGO_EMAIL;
if (!vendorEmail || !ngoEmail) throw new Error("Set SANDBOX_VENDOR_EMAIL and SANDBOX_NGO_EMAIL in .env");

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

await db.execute(
  sql`truncate impact_updates, deliveries, donations, orders, needs, catalog_items, vendors, ngos restart identity cascade`,
);

const [hope, riverbend] = await db
  .insert(schema.ngos)
  .values([
    {
      slug: "hope-shelter",
      name: "Hope Shelter",
      city: "Tacoma",
      country: "US",
      description: "A 30-bed emergency shelter run by two staff and a rota of volunteers.",
      paypalEmail: ngoEmail,
      status: "demo", // fictional charities, labelled as demo rather than verified
    },
    {
      slug: "riverbend-school",
      name: "Riverbend Community School",
      city: "Yakima",
      country: "US",
      description: "A volunteer-run after-school programme for 60 children of farmworker families.",
      paypalEmail: ngoEmail,
      status: "demo", // fictional charities, labelled as demo rather than verified
    },
  ])
  .returning();

// All demo vendors pay out to the same sandbox business account.
// Northside starts with an empty catalog to demo onboarding from a price-list photo.
const [sunrise, harbor] = await db
  .insert(schema.vendors)
  .values([
    { slug: "sunrise-supplies", name: "Sunrise Supplies", city: "Tacoma", country: "US", paypalEmail: vendorEmail, trustScore: 72 },
    { slug: "harbor-wholesale", name: "Harbor Wholesale", city: "Seattle", country: "US", paypalEmail: vendorEmail, trustScore: 64 },
    { slug: "northside-wholesale", name: "Northside Wholesale", city: "Spokane", country: "US", paypalEmail: vendorEmail, trustScore: 50 },
  ])
  .returning();

const catalog = [
  { vendorId: sunrise.id, name: "Fleece blanket", spec: "fleece blanket, twin size", unit: "blanket", unitPriceCents: 1800 },
  { vendorId: sunrise.id, name: "Sleeping bag", spec: "sleeping bag, adult, rectangular, 40°F rated, synthetic fill", unit: "sleeping bag", unitPriceCents: 3800 },
  { vendorId: sunrise.id, name: "White rice, 25 lb", spec: "white rice, 25 lb bag", unit: "bag", unitPriceCents: 2200 },
  { vendorId: harbor.id, name: "Fleece blanket", spec: "fleece blanket, twin size", unit: "blanket", unitPriceCents: 2100 },
  { vendorId: harbor.id, name: "Kids school backpack", spec: "kids school backpack", unit: "backpack", unitPriceCents: 2400 },
  { vendorId: harbor.id, name: "Toothbrush & toothpaste kit", spec: "toothbrush and toothpaste travel kit", unit: "kit", unitPriceCents: 900 },
];

// One market search per distinct spec; vendors selling the same item share it.
const benchmarks = new Map<string, Awaited<ReturnType<typeof createBenchmark>>>();
for (const spec of new Set(catalog.map((c) => c.spec))) {
  const started = Date.now();
  const b = skipBenchmark ? undefined : await createBenchmark(spec);
  benchmarks.set(spec, b);
  const market = b ? `market $${(b.medianCents / 100).toFixed(2)} (n=${b.products.length})` : "no benchmark";
  console.log(`  ${spec}: ${market} (${Date.now() - started} ms)`);
}

const items = await db
  .insert(schema.catalogItems)
  .values(
    catalog.map((c) => {
      const b = benchmarks.get(c.spec);
      return { ...c, benchmark: b, imageUrl: b?.products.find((p) => p.imageUrl)?.imageUrl ?? null };
    }),
  )
  .returning();
const item = (vendorId: number, name: string) => items.find((i) => i.vendorId === vendorId && i.name === name)!;

const needs = [
  {
    ngo: hope,
    item: item(sunrise.id, "Fleece blanket"),
    title: "40 fleece blankets for winter nights",
    story: "Night temperatures drop below freezing next week and half our beds have only a sheet.",
    quantity: 40,
    urgency: "high" as const,
    deadline: inDays(9),
  },
  {
    ngo: hope,
    item: item(sunrise.id, "Sleeping bag"),
    title: "20 sleeping bags for overflow nights",
    story: "When all 30 beds are full we open the hall floor. Sleeping bags make that bearable.",
    quantity: 20,
    urgency: "medium" as const,
    deadline: inDays(21),
  },
  {
    ngo: hope,
    item: item(sunrise.id, "White rice, 25 lb"),
    title: "12 bags of rice for the shelter kitchen",
    story: "Rice is the base of most of our evening meals for 30 people.",
    quantity: 12,
    urgency: "medium" as const,
    deadline: inDays(14),
    priceJustification: "Local wholesale price for 25 lb bags, delivered to the shelter.",
  },
  {
    ngo: riverbend,
    item: item(harbor.id, "Kids school backpack"),
    title: "30 backpacks for the new term",
    story: "Many of our kids carry books in plastic bags. A backpack each keeps homework dry.",
    quantity: 30,
    urgency: "low" as const,
    deadline: inDays(30),
  },
  {
    ngo: riverbend,
    item: item(harbor.id, "Toothbrush & toothpaste kit"),
    title: "60 toothbrush kits for our dental-health week",
    story: "A local dentist volunteers a session; we want every child to go home with a kit.",
    quantity: 60,
    urgency: "medium" as const,
    deadline: inDays(18),
  },
];

for (const n of needs) {
  const check = checkVendorPrice(n.item.unitPriceCents, n.item.benchmark ?? undefined);
  await db.insert(schema.needs).values({
    ngoId: n.ngo.id,
    vendorId: n.item.vendorId,
    catalogItemId: n.item.id,
    title: n.title,
    story: n.story,
    quantity: n.quantity,
    unitPriceCents: n.item.unitPriceCents,
    urgency: n.urgency,
    deadline: n.deadline,
    benchmark: n.item.benchmark,
    fairPrice: check.verdict,
    priceJustification: "priceJustification" in n ? n.priceJustification : null,
    imageUrl: n.item.imageUrl,
  });
  console.log(`✓ ${n.title} — $${(n.item.unitPriceCents / 100).toFixed(2)} → ${check.verdict}`);
}

console.log("Seeded.");
process.exit(0);
