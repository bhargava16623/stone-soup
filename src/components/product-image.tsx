// Product photos come from many retailer CDNs (via Channel3), so they're rendered as plain images.
/* eslint-disable @next/next/no-img-element */
import { Package } from "lucide-react";

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
  if (!src) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Package className="h-9 w-9" aria-hidden />
        </span>
      </div>
    );
  }
  const fitClass = fit === "cover" ? "object-cover" : "bg-white object-contain";
  return <img src={src} alt={alt} loading="lazy" className={`${fitClass} ${className}`} />;
}
