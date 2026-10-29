"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** A block of text (a URL or config snippet) with a copy button. */
export function CopyText({ text, block = false }: { text: string; block?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`relative rounded-xl border border-border bg-background ${block ? "p-4 pr-12" : "px-3 py-2 pr-12"}`}>
      {block ? <pre className="overflow-x-auto text-xs leading-relaxed">{text}</pre> : <code className="break-all text-sm">{text}</code>}
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 rounded-lg p-1.5 text-muted transition hover:bg-accent-soft hover:text-accent"
        aria-label="Copy"
      >
        {copied ? <Check className="h-4 w-4 text-leaf" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
