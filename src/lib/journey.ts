// "Follow your dollar": every step a single gift took, from the donor's PayPal approval to the
// thank-you note, with the IDs that prove each step. Public by PayPal capture ID; donors appear
// by first name only, as on the ledger.
import "server-only";
import { db } from "@/db/index.ts";
import { formatUsd } from "./fees.ts";

export type StepState = "done" | "waiting";

export interface JourneyStep {
  key: "gave" | "paid" | "price" | "delivered" | "verified" | "thanked";
  title: string;
  detail: string;
  at: string | null; // ISO time
  proof: { label: string; value: string }[];
  state: StepState;
}

export interface Journey {
  captureId: string;
  donor: string;
  item: string;
  units: number;
  unit: string;
  amountCents: number;
  ngo: { name: string; city: string };
  vendor: { name: string; city: string };
  needId: number;
  /** How far the stone has travelled along donor → PayPal → supplier → charity (0–1). */
  progress: number;
  photoDeliveryId: number | null;
  message: string | null;
  steps: JourneyStep[];
}

const VIA = { direct: "on Stone Soup", agent: "with the Giving Agent" } as const;

export async function getJourney(captureId: string): Promise<Journey | undefined> {
  const d = await db.query.donations.findFirst({
    where: (d, { and, eq }) => and(eq(d.captureId, captureId), eq(d.captured, true)),
    with: {
      order: { with: { pot: true } },
      need: { with: { ngo: true, vendor: true, catalogItem: true } },
      impactUpdates: { with: { delivery: { columns: { photo: false } } } },
    },
  });
  if (!d?.captureId) return undefined;
  const { order, need } = d;
  const update = d.impactUpdates[0];
  const delivery = update?.delivery;
  const donor = order.donorName?.split(" ")[0] ?? "A donor";
  const unit = need.catalogItem.unit;
  const units = `${d.units} ${unit}${d.units === 1 ? "" : "s"}`;
  const via = order.clubBasketId ? "through Soup Club" : order.pot ? `in the group pot “${order.pot.title}”` : VIA[order.source];

  const bench = need.benchmark;
  const saved = bench ? Math.max(0, bench.medianCents - need.unitPriceCents) * d.units : 0;
  const priceDetail = bench
    ? `${formatUsd(need.unitPriceCents)} per ${unit}, against a market median of ${formatUsd(bench.medianCents)} across ${bench.products.length} real products${
        saved > 0 ? ` — ${formatUsd(saved)} less than buying it at the going rate` : ""
      }.`
    : `No market price was found online, so ${need.ngo.name} explained the price: “${need.priceJustification ?? "local supplier price"}”.`;

  const steps: JourneyStep[] = [
    {
      key: "price",
      title: "Price checked against the market",
      detail: priceDetail,
      at: need.createdAt.toISOString(),
      proof: bench ? [{ label: "Checked", value: new Date(bench.checkedAt).toISOString().slice(0, 10) }] : [],
      state: "done",
    },
    {
      key: "gave",
      title: `${donor} gave ${units}`,
      detail: `Approved in PayPal ${via}. The amount was set by the supplier's checked price, not typed by anyone.`,
      at: order.capturedAt?.toISOString() ?? null,
      proof: [{ label: "PayPal order", value: order.paypalOrderId }],
      state: "done",
    },
    {
      key: "paid",
      title: `PayPal paid ${need.vendor.name} directly`,
      detail: `${formatUsd(d.vendorAmountCents)} went straight to the supplier in ${need.vendor.city}${
        d.feeCoverCents > 0 ? `, including ${formatUsd(d.feeCoverCents)} the donor added to cover PayPal's fee` : ""
      }. Stone Soup never held the money, and it can't be spent on anything else.`,
      at: order.capturedAt?.toISOString() ?? null,
      proof: [
        { label: "PayPal capture", value: d.captureId },
        { label: "Payee", value: need.vendor.name },
      ],
      state: "done",
    },
    {
      key: "delivered",
      title: `Delivered to ${need.ngo.name}`,
      detail: delivery
        ? `${need.vendor.name} delivered ${delivery.units} ${unit}${delivery.units === 1 ? "" : "s"} to ${need.ngo.name} in ${need.ngo.city}, including these.`
        : `${need.vendor.name} is preparing the delivery to ${need.ngo.name} in ${need.ngo.city}.`,
      at: delivery?.createdAt.toISOString() ?? null,
      proof: delivery ? [{ label: "Delivery", value: `#${delivery.id}` }] : [],
      state: delivery ? "done" : "waiting",
    },
    {
      key: "verified",
      title: "Photo checked by AI",
      detail: delivery?.aiSummary ?? "When the charity uploads a delivery photo, Gemini checks it shows the right items and wasn't used before.",
      at: delivery?.createdAt.toISOString() ?? null,
      proof: delivery ? [{ label: "Verdict", value: "Verified" }] : [],
      state: delivery ? "done" : "waiting",
    },
    {
      key: "thanked",
      title: `A note for ${donor}`,
      detail: update?.message ?? "A short note about what this gift did, written from the delivery.",
      at: update?.createdAt.toISOString() ?? null,
      proof: [],
      state: update ? "done" : "waiting",
    },
  ];

  return {
    captureId: d.captureId,
    donor,
    item: need.catalogItem.name,
    units: d.units,
    unit,
    amountCents: d.vendorAmountCents,
    ngo: { name: need.ngo.name, city: need.ngo.city },
    vendor: { name: need.vendor.name, city: need.vendor.city },
    needId: need.id,
    // Paid but not yet delivered: the stone has left the supplier and is on its way to the charity.
    progress: delivery ? 1 : 0.74,
    photoDeliveryId: delivery?.id ?? null,
    message: update?.message ?? null,
    steps,
  };
}
