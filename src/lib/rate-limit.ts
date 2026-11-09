// In-memory, per-IP rate limits for the endpoints that call Gemini, so one visitor can't burn the
// AI quota. Good enough for a single server instance; use Redis or similar when scaling out.
import "server-only";
import { headers } from "next/headers";

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests right now. Please wait a minute and try again.");
  }
}

const hits = new Map<string, number[]>();

/** The caller's IP from proxy headers (Render sets x-forwarded-for). */
export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** Throw RateLimitError when `key` has made more than `limit` calls in the last `windowMs`. */
export function limit(key: string, max: number, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    throw new RateLimitError();
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
}

/** Rate-limit a server action by the caller's IP. */
export async function limitAction(name: string, max: number, windowMs?: number) {
  limit(`${name}:${clientIp(await headers())}`, max, windowMs);
}
