// Product photos come from many retailer CDNs (via Channel3), so they're rendered as plain images.
/* eslint-disable @next/next/no-img-element */
import { Package } from "lucide-react";

/**
 * `contain`: a product shot on a rounded "plate" tile; the photo's white background blends into it
 * (multiply), so it reads as one object in light and dark mode. `cover`: a real photo filling the box.
 */
export function ProductImage({
  src,
  alt,
  className = "",
  fit = "contain",
}: {
  src: string | null;
  alt: string;
  className?: string;
  fit?: "contain" | "cover";
}) {
  if (fit === "cover" && src) {
    return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center ${className}`}>
      {src ? (
        <span className="flex aspect-square h-full max-w-full items-center justify-center rounded-2xl bg-plate p-3">
          <img src={src} alt={alt} loading="lazy" className="h-full w-full object-contain mix-blend-multiply" />
        </span>
      ) : (
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Package className="h-9 w-9" aria-hidden />
        </span>
      )}
    </div>
  );
}
