import { db } from "@/db/index.ts";

/** Serve a delivery photo stored in the database. */
export async function GET(_request: Request, ctx: RouteContext<"/api/deliveries/[id]/photo">) {
  const { id } = await ctx.params;
  const delivery = await db.query.deliveries.findFirst({
    where: (d, { eq }) => eq(d.id, Number(id)),
    columns: { photo: true, photoMime: true },
  });
  if (!delivery) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(delivery.photo), {
    headers: { "Content-Type": delivery.photoMime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
