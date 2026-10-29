import { getLiveSnapshot } from "@/lib/pots.ts";

/** Current state of a pot for the live wall. */
export async function GET(_request: Request, ctx: RouteContext<"/api/pots/[slug]/live">) {
  const { slug } = await ctx.params;
  const snapshot = await getLiveSnapshot(slug);
  if (!snapshot) return Response.json({ error: "Unknown pot" }, { status: 404 });
  return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
