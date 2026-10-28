"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClubError, getMember, joinClub, prepareBasket, skipBasket, updateMember } from "@/lib/club.ts";

// Members are identified only by their private link token (no logins in this demo).

type Result = { ok: true } | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => {
  if (!(e instanceof ClubError)) console.error("soup club action failed", e);
  return { ok: false, error: e instanceof ClubError ? e.message : "Something went wrong. Please try again." };
};

export async function joinClubAction(input: { name: string; monthlyBudgetCents: number; causes: string }): Promise<Result> {
  let token: string;
  try {
    const member = await joinClub(input);
    token = member.token;
    // Prepare the first basket straight away; if the agent is busy, the member can retry from their page.
    await prepareBasket(member.id).catch((e) => console.error("first club basket failed", e));
  } catch (e) {
    return fail(e);
  }
  redirect(`/club/${token}`);
}

export async function rebuildBasketAction(token: string): Promise<Result> {
  try {
    const member = await getMember(token);
    await prepareBasket(member.id, { rebuild: true });
    revalidatePath(`/club/${token}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function skipMonthAction(token: string): Promise<Result> {
  try {
    await skipBasket(token);
    revalidatePath(`/club/${token}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateMemberAction(token: string, patch: { monthlyBudgetCents?: number; causes?: string; active?: boolean }): Promise<Result> {
  try {
    await updateMember(token, patch);
    revalidatePath(`/club/${token}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
