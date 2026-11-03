"use server";

import { revalidatePath } from "next/cache";
import { approveFlaggedDelivery, writeImpactUpdates } from "@/lib/delivery.ts";
import { approveCharity } from "@/lib/verify.ts";

// Demo note: in production this is restricted to Stone Soup reviewers.
export async function approveDeliveryAction(deliveryId: number): Promise<{ ok: boolean; error?: string }> {
  try {
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
  await approveCharity(ngoId);
  revalidatePath("/review");
  revalidatePath("/ngo");
  return { ok: true };
}
