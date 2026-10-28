// Product photos come from many retailer CDNs (via Channel3), so they're rendered as plain images.
/* eslint-disable @next/next/no-img-element */
export function ProductImage({ src, alt, className = "" }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return <div className={`flex items-center justify-center bg-accent-soft font-serif text-4xl text-accent ${className}`}>◯</div>;
  }
  return <img src={src} alt={alt} loading="lazy" className={`bg-white object-contain ${className}`} />;
}
