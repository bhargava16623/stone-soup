"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertReviewer, unlockReviewer } from "@/lib/access.ts";
import { approveFlaggedDelivery, writeImpactUpdates } from "@/lib/delivery.ts";
import { limitAction } from "@/lib/rate-limit.ts";
import { approveCharity } from "@/lib/verify.ts";

export async function approveDeliveryAction(deliveryId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertReviewer();
    const delivery = await approveFlaggedDelivery(deliveryId);
    await writeImpactUpdates(delivery.id).catch((e) => console.error("impact updates failed", e));
    revalidatePath("/review");
    revalidatePath(`/needs/${delivery.needId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not approve" };
  }
}

export async function approveCharityAction(ngoId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertReviewer();
    await approveCharity(ngoId);
    revalidatePath("/review");
    revalidatePath("/ngo");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not approve" };
  }
}

export async function unlockReviewAction(formData: FormData) {
  await limitAction("review-unlock", 5);
  const ok = await unlockReviewer(String(formData.get("key") ?? ""));
  redirect(ok ? "/review" : "/review?wrong=1");
}
