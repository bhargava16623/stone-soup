"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Share2 } from "lucide-react";

export function ShareLink({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  // The native share sheet exists only in some browsers; false on the server so hydration matches.
  const canShare = useSyncExternalStore(
    () => () => {},
    () => "share" in navigator,
    () => false,
  );
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition hover:border-accent hover:text-accent"
      >
        {copied ? <Check className="h-4 w-4 text-leaf" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy link"}
      </button>
      {canShare && (
        <button
          type="button"
          onClick={() => navigator.share({ title, url }).catch(() => {})}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition hover:border-accent hover:text-accent"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
      )}
    </div>
  );
}
