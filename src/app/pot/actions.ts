"use server";

import { redirect } from "next/navigation";
import { createPot, PotError } from "@/lib/pots.ts";

export async function createPotAction(input: { needId: number; title: string; organizerName: string; goalUnits: number }) {
  let slug: string;
  try {
    slug = (await createPot(input)).slug;
  } catch (e) {
    if (!(e instanceof PotError)) console.error("createPot failed", e);
    return { ok: false as const, error: e instanceof PotError ? e.message : "Could not start the pot" };
  }
  redirect(`/pot/${slug}`);
}
