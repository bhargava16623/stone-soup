"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/index.ts";
import { addCatalogItems, readPriceList, type CatalogEntry } from "@/lib/catalog.ts";

// Demo note: there are no logins; anyone on a vendor's page acts as that vendor.

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : "Something went wrong",
});

const MAX_IMAGE_BASE64 = 1_400_000; // ~1 MB image after base64

export async function readPriceListAction(imageBase64: string, mimeType: string): Promise<Result<CatalogEntry[]>> {
  try {
    if (!mimeType.startsWith("image/")) throw new Error("Upload an image");
    if (imageBase64.length > MAX_IMAGE_BASE64) throw new Error("That image is too large");
    const items = await readPriceList(imageBase64, mimeType);
    if (items.length === 0) throw new Error("We couldn't read any priced items in that photo");
    return { ok: true, data: items };
  } catch (e) {
    console.error("readPriceList failed", e);
    return fail(e);
  }
}

export async function addCatalogItemsAction(vendorSlug: string, entries: CatalogEntry[]): Promise<Result<{ added: number }>> {
  try {
    const vendor = await db.query.vendors.findFirst({ where: (v, { eq }) => eq(v.slug, vendorSlug) });
    if (!vendor) throw new Error("Unknown vendor");
    const rows = await addCatalogItems(vendor.id, entries.slice(0, 25));
    revalidatePath(`/vendor/${vendorSlug}`);
    return { ok: true, data: { added: rows.length } };
  } catch (e) {
    return fail(e);
  }
}
