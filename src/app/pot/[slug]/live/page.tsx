import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import QRCode from "qrcode";
import { LiveWall } from "@/components/live-wall.tsx";
import { getLiveSnapshot, getPot } from "@/lib/pots.ts";

export const metadata: Metadata = { title: "Live pot · Stone Soup" };

export default function LivePotPage({ params }: PageProps<"/pot/[slug]/live">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[60] bg-background" />}>
      <Live params={params} />
    </Suspense>
  );
}

async function Live({ params }: { params: PageProps<"/pot/[slug]/live">["params"] }) {
  const { slug } = await params;
  const [pot, snapshot] = await Promise.all([getPot(slug), getLiveSnapshot(slug)]);
  if (!pot || !snapshot) notFound();

  const h = await headers();
  const shareUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/pot/${pot.slug}`;
  const qrSvg = await QRCode.toString(shareUrl, { type: "svg", margin: 1, color: { dark: "#2b2118", light: "#ffffff" } });

  return (
    <LiveWall
      slug={pot.slug}
      initial={snapshot}
      qrSvg={qrSvg}
      shareUrl={shareUrl}
      title={pot.title}
      organizer={pot.organizerName}
      ngoName={pot.need.ngo.name}
      vendorName={pot.need.vendor.name}
      unit={pot.need.catalogItem.unit}
      unitPriceCents={pot.need.unitPriceCents}
    />
  );
}
