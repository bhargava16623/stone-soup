"use server";

import { AccessError, grantNgoOwner } from "@/lib/access.ts";
import { limitAction, RateLimitError } from "@/lib/rate-limit.ts";
import { lookupEin, registerNgo, VerifyError, type IrsRecord, type RegisterInput } from "@/lib/verify.ts";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => {
  const known = e instanceof VerifyError || e instanceof RateLimitError || e instanceof AccessError;
  if (!known) console.error("charity registration failed", e);
  return { ok: false, error: known ? (e as Error).message : "Something went wrong" };
};

export async function lookupEinAction(ein: string): Promise<Result<IrsRecord>> {
  try {
    await limitAction("ein-lookup", 20);
    return { ok: true, data: await lookupEin(ein) };
  } catch (e) {
    return fail(e);
  }
}

export async function registerNgoAction(input: RegisterInput): Promise<Result<{ slug: string }>> {
  try {
    await limitAction("ngo-register", 5, 60 * 60_000);
    const ngo = await registerNgo(input);
    // Only this browser can manage the new charity's dashboard.
    await grantNgoOwner(ngo.id);
    return { ok: true, data: { slug: ngo.slug } };
  } catch (e) {
    return fail(e);
  }
}
