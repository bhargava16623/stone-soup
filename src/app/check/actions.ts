"use server";

import { checkAppeal, type ScamCheckResult } from "@/lib/scam-check.ts";
import { getOpenNeeds } from "@/lib/queries.ts";
import { limitAction, RateLimitError } from "@/lib/rate-limit.ts";
import { ALLOWED_PHOTO_TYPES } from "@/lib/photos.ts";

export interface SuggestedNeed {
  id: number;
  title: string;
  ngo: string;
  city: string;
  unitPriceCents: number;
  unit: string;
  imageUrl: string | null;
}

const MAX_IMAGE_BASE64 = 1_400_000;

export async function checkAppealAction(input: {
  url?: string;
  text?: string;
  image?: { base64: string; mimeType: string };
}): Promise<{ ok: true; data: ScamCheckResult & { needs: SuggestedNeed[] } } | { ok: false; error: string }> {
  try {
    await limitAction("scam-check", 8);
    if (input.image && (!ALLOWED_PHOTO_TYPES.includes(input.image.mimeType) || input.image.base64.length > MAX_IMAGE_BASE64)) {
      throw new Error("Upload an image under 1 MB");
    }
    const result = await checkAppeal({
      url: input.url?.slice(0, 2000),
      text: input.text?.slice(0, 6000),
      image: input.image,
    });
    const open = await getOpenNeeds();
    const needs = result.suggestedNeedIds
      .map((id) => open.find((n) => n.id === id))
      .filter((n) => n !== undefined)
      .map((n) => ({
        id: n.id,
        title: n.title,
        ngo: n.ngo.name,
        city: n.ngo.city,
        unitPriceCents: n.unitPriceCents,
        unit: n.catalogItem.unit,
        imageUrl: n.imageUrl,
      }));
    return { ok: true, data: { ...result, needs } };
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    console.error("scam check failed", e);
    const message = e instanceof Error && /Paste a link|Upload an image/.test(e.message) ? e.message : "The check couldn't finish. Please try again in a moment.";
    return { ok: false, error: message };
  }
}
