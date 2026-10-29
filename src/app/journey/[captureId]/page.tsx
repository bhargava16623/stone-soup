import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Route } from "lucide-react";
import { GiftJourney } from "@/components/gift-journey.tsx";
import { PageHeader } from "@/components/page-header.tsx";
import { ProductImage } from "@/components/product-image.tsx";
import { ShareLink } from "@/components/share-link.tsx";
import { formatUsd } from "@/lib/fees.ts";
import { getJourney } from "@/lib/journey.ts";

export default function JourneyPage({ params }: PageProps<"/journey/[captureId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <JourneyView params={params} />
    </Suspense>
  );
}

async function JourneyView({ params }: { params: PageProps<"/journey/[captureId]">["params"] }) {
  const { captureId } = await params;
  const journey = await getJourney(captureId);
  if (!journey) notFound();
  const h = await headers();
  const url = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/journey/${journey.captureId}`;
  const what = `${journey.units} ${journey.unit}${journey.units === 1 ? "" : "s"}`;

  return (
    <div className="max-w-5xl">
      <PageHeader icon={Route} eyebrow="Follow the dollar" title={`${formatUsd(journey.amountCents)} → ${what} for ${journey.ngo.name}`}>
        Every step this gift took, with the PayPal IDs that prove it.{" "}
        <Link href={`/needs/${journey.needId}`} className="text-accent hover:underline">
          See the need
        </Link>
        .
      </PageHeader>
      <GiftJourney journey={journey} />
      {journey.photoDeliveryId && (
        <div className="mt-8 flex flex-col gap-5 rounded-3xl border border-leaf/30 bg-leaf-soft/40 p-6 sm:flex-row">
          <ProductImage
            src={`/api/deliveries/${journey.photoDeliveryId}/photo`}
            alt="Delivery photo"
            fit="cover"
            className="h-48 w-full shrink-0 rounded-2xl border border-border sm:w-64"
          />
          {journey.message && <p className="text-lg">{journey.message}</p>}
        </div>
      )}
      <div className="mt-8">
        <ShareLink url={url} title={`Follow this gift: ${what} for ${journey.ngo.name}`} />
      </div>
    </div>
  );
}
