import type { Metadata } from "next";
import { networkInterfaces } from "node:os";
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

  const shareUrl = `${await phoneOrigin()}/pot/${pot.slug}`;
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

/**
 * Where a phone scanning the QR code can reach this site: PUBLIC_BASE_URL when set; otherwise the
 * request's host, with "localhost" swapped for this machine's LAN address so phones on the same
 * Wi-Fi can open it during a local demo.
 */
async function phoneOrigin(): Promise<string> {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const [name, port] = host.split(":");
  if (name === "localhost" || name === "127.0.0.1") {
    // Skip Docker and VM bridges; they aren't reachable from a phone.
    const lan = Object.entries(networkInterfaces())
      .filter(([iface]) => !/^(docker|br-|veth|virbr|vmnet|lo)/.test(iface))
      .flatMap(([, addrs]) => addrs ?? [])
      .find((a) => a.family === "IPv4" && !a.internal)?.address;
    if (lan) return `${proto}://${lan}${port ? `:${port}` : ""}`;
  }
  return `${proto}://${host}`;
}
