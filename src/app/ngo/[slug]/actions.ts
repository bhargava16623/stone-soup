"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/index.ts";
import { confirmDelivery, DeliveryError, writeImpactUpdates } from "@/lib/delivery.ts";
import { draftNeeds, publishNeed, type NeedDraft, type PublishInput } from "@/lib/intake.ts";

// Demo note: there are no logins; anyone on an NGO's dashboard acts as that NGO.

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : "Something went wrong",
});

export async function draftNeedsAction(request: string): Promise<Result<NeedDraft[]>> {
  try {
    return { ok: true, data: await draftNeeds(request) };
  } catch (e) {
    console.error("draftNeeds failed", e);
    return fail(e);
  }
}

export async function publishNeedAction(ngoSlug: string, input: Omit<PublishInput, "ngoId">): Promise<Result<{ id: number }>> {
  try {
    const ngo = await db.query.ngos.findFirst({ where: (n, { eq }) => eq(n.slug, ngoSlug) });
    if (!ngo) throw new Error("Unknown organisation");
    const need = await publishNeed({ ...input, ngoId: ngo.id });
    revalidatePath("/");
    revalidatePath(`/ngo/${ngoSlug}`);
    return { ok: true, data: { id: need.id } };
  } catch (e) {
    return fail(e);
  }
}

const MAX_PHOTO_BASE64 = 1_400_000;

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
    const ngo = await db.query.ngos.findFirst({ where: (n, { eq }) => eq(n.slug, ngoSlug) });
    if (!ngo) throw new Error("Unknown organisation");
    if (!input.photoMime.startsWith("image/")) throw new Error("Upload a photo");
    if (input.photoBase64.length > MAX_PHOTO_BASE64) throw new Error("That photo is too large");
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
    if (!(e instanceof DeliveryError)) console.error("confirmDelivery failed", e);
    return fail(e);
  }
}
