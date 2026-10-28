// Funder report: verified facts about what an NGO received, plus a short narrative Gemini writes
// from those facts only. Every number on the report comes from payments and verified deliveries.
import "server-only";
import { cacheLife } from "next/cache";
import { db } from "@/db/index.ts";
import { formatUsd } from "./fees.ts";
import { generate } from "./gemini.ts";

export interface ReportFacts {
  ngo: { name: string; city: string; description: string };
  since: string; // ISO date of the first need
  itemsDelivered: { item: string; unit: string; units: number; valueCents: number }[];
  unitsDelivered: number;
  valueDeliveredCents: number;
  savedVsMarketCents: number; // (market median − price paid) × units, for benchmarked items
  fundedCents: number; // paid to suppliers for this NGO's needs
  donors: number;
  giftsViaAgent: number;
  gifts: number;
  suppliers: { name: string; paidCents: number }[];
  needsOpen: number;
  needsCompleted: number;
  photos: { deliveryId: number; caption: string }[];
  flaggedDeliveries: number;
}

export async function getReportFacts(slug: string): Promise<ReportFacts | undefined> {
  const ngo = await db.query.ngos.findFirst({
    where: (n, { eq }) => eq(n.slug, slug),
    with: {
      needs: {
        with: {
          catalogItem: true,
          vendor: true,
          donations: { where: (d, { eq }) => eq(d.captured, true), with: { order: true } },
          deliveries: { columns: { photo: false } },
        },
      },
    },
  });
  if (!ngo) return undefined;

  const items = new Map<string, ReportFacts["itemsDelivered"][number]>();
  const suppliers = new Map<string, number>();
  const donors = new Set<string>();
  let saved = 0;
  let funded = 0;
  let gifts = 0;
  let viaAgent = 0;
  const photos: ReportFacts["photos"] = [];
  let flagged = 0;

  for (const need of ngo.needs) {
    const verified = need.deliveries.filter((d) => d.verdict === "verified");
    const delivered = verified.reduce((s, d) => s + d.units, 0);
    flagged += need.deliveries.filter((d) => d.verdict === "flagged").length;
    if (delivered > 0) {
      const key = need.catalogItem.name;
      const row = items.get(key) ?? { item: key, unit: need.catalogItem.unit, units: 0, valueCents: 0 };
      row.units += delivered;
      row.valueCents += delivered * need.unitPriceCents;
      items.set(key, row);
      if (need.benchmark) saved += Math.max(0, need.benchmark.medianCents - need.unitPriceCents) * delivered;
      for (const d of verified) photos.push({ deliveryId: d.id, caption: d.aiSummary ?? `${d.units} × ${need.catalogItem.name}` });
    }
    for (const d of need.donations) {
      gifts++;
      if (d.order.source === "agent") viaAgent++;
      donors.add(d.order.donorEmail ?? d.order.donorName ?? `order-${d.orderId}`);
      funded += d.vendorAmountCents - d.feeCoverCents;
      suppliers.set(need.vendor.name, (suppliers.get(need.vendor.name) ?? 0) + d.vendorAmountCents - d.feeCoverCents);
    }
  }

  const itemsDelivered = [...items.values()].sort((a, b) => b.valueCents - a.valueCents);
  return {
    ngo: { name: ngo.name, city: ngo.city, description: ngo.description },
    since: (ngo.needs.map((n) => n.createdAt).sort((a, b) => a.getTime() - b.getTime())[0] ?? ngo.createdAt).toISOString(),
    itemsDelivered,
    unitsDelivered: itemsDelivered.reduce((s, i) => s + i.units, 0),
    valueDeliveredCents: itemsDelivered.reduce((s, i) => s + i.valueCents, 0),
    savedVsMarketCents: saved,
    fundedCents: funded,
    donors: donors.size,
    giftsViaAgent: viaAgent,
    gifts,
    suppliers: [...suppliers.entries()].map(([name, paidCents]) => ({ name, paidCents })).sort((a, b) => b.paidCents - a.paidCents),
    needsOpen: ngo.needs.filter((n) => n.status === "open").length,
    needsCompleted: ngo.needs.filter((n) => n.status === "verified").length,
    photos: photos.slice(0, 8),
    flaggedDeliveries: flagged,
  };
}

const NARRATIVE_SYSTEM = `Write the summary section of a short report a small charity sends to a funder or its board.
Use only the facts provided; every number you mention must appear in them. Plain, warm, specific language;
no exaggeration, no invented outcomes or people. Two short paragraphs: what was received and delivered, then
how it was made accountable (suppliers paid directly via PayPal, prices checked against the market, deliveries
verified with photos). If nothing has been delivered yet, say so plainly.`;

/** Narrative for a report, cached per set of facts so re-opening the report doesn't call Gemini again. */
export async function writeReportNarrative(factsJson: string): Promise<string> {
  "use cache";
  cacheLife("days");
  const facts = JSON.parse(factsJson) as ReportFacts;
  const readable = {
    ...facts,
    valueDelivered: formatUsd(facts.valueDeliveredCents),
    savedVsMarket: formatUsd(facts.savedVsMarketCents),
    fundedToSuppliers: formatUsd(facts.fundedCents),
    photos: facts.photos.map((p) => p.caption),
  };
  const { text } = await generate(JSON.stringify(readable), { system: NARRATIVE_SYSTEM });
  return text.trim();
}
