"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/index.ts";
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
