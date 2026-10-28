import { timingSafeEqual } from "node:crypto";
import { prepareDueBaskets } from "@/lib/club.ts";

/** Monthly job: prepare every active Soup Club member's basket. Call with `Authorization: Bearer $CRON_SECRET`. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not configured", { status: 503 });
  const given = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await prepareDueBaskets());
}
