"use server";

import { lookupEin, registerNgo, VerifyError, type IrsRecord, type RegisterInput } from "@/lib/verify.ts";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => {
  if (!(e instanceof VerifyError)) console.error("charity registration failed", e);
  return { ok: false, error: e instanceof VerifyError ? e.message : "Something went wrong" };
};

export async function lookupEinAction(ein: string): Promise<Result<IrsRecord>> {
  try {
    return { ok: true, data: await lookupEin(ein) };
  } catch (e) {
    return fail(e);
  }
}

export async function registerNgoAction(input: RegisterInput): Promise<Result<{ slug: string }>> {
  try {
    const ngo = await registerNgo(input);
    return { ok: true, data: { slug: ngo.slug } };
  } catch (e) {
    return fail(e);
  }
}
