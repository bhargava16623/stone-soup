"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/index.ts";
import { confirmDelivery, DeliveryError, writeImpactUpdates } from "@/lib/delivery.ts";
import { draftNeeds, draftNeedsFromPhoto, publishNeed, type NeedDraft, type PhotoDraft, type PublishInput } from "@/lib/intake.ts";
import { checkWebsite, VerifyError } from "@/lib/verify.ts";
import { AccessError, assertCanManageNgo } from "@/lib/access.ts";
import { limitAction, RateLimitError } from "@/lib/rate-limit.ts";
import { ALLOWED_PHOTO_TYPES } from "@/lib/photos.ts";

// There are no accounts. Seeded demo charities are open to everyone; a registered charity's
// dashboard works only from the browser that registered it (see lib/access.ts).

const MAX_PHOTO_BASE64 = 1_400_000;

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : "Something went wrong",
});

async function managedNgo(slug: string) {
  const ngo = await db.query.ngos.findFirst({ where: (n, { eq }) => eq(n.slug, slug) });
  if (!ngo) throw new Error("Unknown organisation");
  await assertCanManageNgo(ngo);
  return ngo;
}

function checkPhoto(mime: string, base64: string) {
  if (!ALLOWED_PHOTO_TYPES.includes(mime)) throw new Error("Upload a JPEG, PNG, WebP or HEIC photo");
  if (base64.length > MAX_PHOTO_BASE64) throw new Error("That photo is too large");
}

export async function draftNeedsAction(ngoSlug: string, request: string): Promise<Result<NeedDraft[]>> {
  try {
    await managedNgo(ngoSlug);
    await limitAction("intake", 10);
    return { ok: true, data: await draftNeeds(request) };
  } catch (e) {
    if (!(e instanceof AccessError || e instanceof RateLimitError)) console.error("draftNeeds failed", e);
    return fail(e);
  }
}

export async function draftNeedsFromPhotoAction(
  ngoSlug: string,
  input: { photoBase64: string; photoMime: string; note: string },
): Promise<Result<PhotoDraft>> {
  try {
    await managedNgo(ngoSlug);
    await limitAction("intake", 10);
    checkPhoto(input.photoMime, input.photoBase64);
    return { ok: true, data: await draftNeedsFromPhoto(input.photoBase64, input.photoMime, input.note) };
  } catch (e) {
    if (!(e instanceof AccessError || e instanceof RateLimitError)) console.error("draftNeedsFromPhoto failed", e);
    return fail(e);
  }
}

export async function publishNeedAction(ngoSlug: string, input: Omit<PublishInput, "ngoId">): Promise<Result<{ id: number }>> {
  try {
    const ngo = await managedNgo(ngoSlug);
    const need = await publishNeed({ ...input, ngoId: ngo.id });
    revalidatePath("/");
    revalidatePath(`/ngo/${ngoSlug}`);
    return { ok: true, data: { id: need.id } };
  } catch (e) {
    return fail(e);
  }
}

export interface DeliveryOutcome {
  verdict: "pending" | "verified" | "flagged";
  summary: string;
  concerns: string[];
  updatesSent: number;
}

export async function confirmDeliveryAction(
  ngoSlug: string,
  input: { needId: number; units: number; note: string; photoBase64: string; photoMime: string },
): Promise<Result<DeliveryOutcome>> {
  try {
    const ngo = await managedNgo(ngoSlug);
    await limitAction("delivery", 10);
    checkPhoto(input.photoMime, input.photoBase64);
    const delivery = await confirmDelivery({ ...input, ngoId: ngo.id });

    let updatesSent = 0;
    if (delivery.verdict === "verified") {
      // A failed update shouldn't undo a confirmed delivery; it can be written later.
      updatesSent = (await writeImpactUpdates(delivery.id).catch((e) => (console.error("impact updates failed", e), []))).length;
    }
    revalidatePath(`/ngo/${ngoSlug}`);
    revalidatePath(`/needs/${input.needId}`);
    return { ok: true, data: { verdict: delivery.verdict, summary: delivery.summary, concerns: delivery.concerns, updatesSent } };
  } catch (e) {
    if (!(e instanceof DeliveryError || e instanceof AccessError || e instanceof RateLimitError)) console.error("confirmDelivery failed", e);
    return fail(e);
  }
}

export async function checkWebsiteAction(ngoSlug: string): Promise<Result<{ status: string }>> {
  try {
    await managedNgo(ngoSlug);
    await limitAction("check-website", 6);
    const ngo = await checkWebsite(ngoSlug);
    revalidatePath(`/ngo/${ngoSlug}`);
    revalidatePath(`/ngo/${ngoSlug}/verify`);
    return { ok: true, data: { status: ngo.status } };
  } catch (e) {
    const known = e instanceof VerifyError || e instanceof AccessError || e instanceof RateLimitError;
    if (!known) console.error("checkWebsite failed", e);
    return known ? fail(e) : { ok: false, error: "Something went wrong while checking. Try again." };
  }
}
