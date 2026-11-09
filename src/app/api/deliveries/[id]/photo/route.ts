import { db } from "@/db/index.ts";

/** Serve a delivery photo stored in the database. */
export async function GET(_request: Request, ctx: RouteContext<"/api/deliveries/[id]/photo">) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return new Response("Not found", { status: 404 });
  const delivery = await db.query.deliveries.findFirst({
    where: (d, { eq }) => eq(d.id, Number(id)),
    columns: { photo: true, photoMime: true },
  });
  if (!delivery) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(delivery.photo), {
    headers: {
      // Only raster types are ever stored, but never let a browser treat a photo as a page or script.
      "Content-Type": ["image/jpeg", "image/png", "image/webp", "image/heif", "image/heic"].includes(delivery.photoMime)
        ? delivery.photoMime
        : "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
