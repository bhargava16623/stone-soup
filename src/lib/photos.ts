// Photo checks shared by every upload: an allow-list of raster types, a real decode with sharp
// (so a file that only claims to be an image is refused), and a perceptual hash that still
// matches a reused photo after it has been re-saved, resized or lightly cropped.
import sharp from "sharp";

export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const FORMAT_MIME: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heif: "image/heif" };

export class PhotoError extends Error {}

/** Decode the photo; return its real MIME type and a 64-bit difference hash (16 hex chars). */
export async function inspectPhoto(photo: Buffer): Promise<{ mime: string; dhash: string }> {
  let format: string | undefined;
  try {
    format = (await sharp(photo).metadata()).format;
  } catch {
    throw new PhotoError("That file isn't a readable photo");
  }
  const mime = format && FORMAT_MIME[format];
  if (!mime) throw new PhotoError("Upload a JPEG, PNG, WebP or HEIC photo");

  // dHash: shrink to 9×8 greyscale and record whether each pixel is brighter than its right neighbour.
  const px = await sharp(photo).rotate().greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits = (bits << 1n) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1n : 0n);
  }
  return { mime, dhash: bits.toString(16).padStart(16, "0") };
}

/** Bits that differ between two difference hashes. 0–10 of 64 means "almost certainly the same picture". */
export function hashDistance(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

export const SAME_PHOTO_DISTANCE = 10;
