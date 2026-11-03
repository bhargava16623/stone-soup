"use client";

import { useState, useTransition } from "react";
import { Globe } from "lucide-react";
import { checkWebsiteAction } from "@/app/ngo/[slug]/actions.ts";

export function CheckWebsiteButton({ ngoSlug }: { ngoSlug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await checkWebsiteAction(ngoSlug);
            if (!res.ok) setError(res.error);
          })
        }
        className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
      >
        <Globe className={`h-4 w-4 ${pending ? "animate-pulse" : ""}`} /> {pending ? "Checking your website and the web…" : "Check my website"}
      </button>
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
    </div>
  );
}
