// Lightweight access control without accounts.
// - Reviewers unlock /review with REVIEW_KEY; the browser then holds a signed cookie.
// - A charity registered through /ngo/join is managed only from the browser that registered it
//   (a signed cookie set at registration). Seeded demo charities stay open so anyone can try them.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export class AccessError extends Error {}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ characters)");
  return s;
}

const sign = (label: string) => createHmac("sha256", secret()).update(label).digest("base64url");

function matches(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const COOKIE = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.PUBLIC_BASE_URL?.startsWith("https://") ?? false,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
} as const;

// --- Reviewers ---

const REVIEW_COOKIE = "ss_review";

export async function isReviewer(): Promise<boolean> {
  return matches((await cookies()).get(REVIEW_COOKIE)?.value, sign("reviewer"));
}

export async function unlockReviewer(key: string): Promise<boolean> {
  const expected = process.env.REVIEW_KEY;
  if (!expected || !matches(key.trim(), expected)) return false;
  (await cookies()).set(REVIEW_COOKIE, sign("reviewer"), COOKIE);
  return true;
}

export async function assertReviewer() {
  if (!(await isReviewer())) throw new AccessError("Only Stone Soup reviewers can do this");
}

// --- Charity owners ---

const ngoCookie = (id: number) => `ss_ngo_${id}`;

export async function grantNgoOwner(ngoId: number) {
  (await cookies()).set(ngoCookie(ngoId), sign(`ngo:${ngoId}`), COOKIE);
}

/** Demo charities are open to everyone; registered charities only to the browser that registered them. */
export async function canManageNgo(ngo: { id: number; status: string }): Promise<boolean> {
  if (ngo.status === "demo") return true;
  return matches((await cookies()).get(ngoCookie(ngo.id))?.value, sign(`ngo:${ngo.id}`));
}

export async function assertCanManageNgo(ngo: { id: number; name: string; status: string }) {
  if (!(await canManageNgo(ngo))) {
    throw new AccessError(`Only the person who registered ${ngo.name} can do this, from the browser they registered with`);
  }
}
