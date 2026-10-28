"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110 active:scale-[0.98]"
    >
      <Printer className="h-4 w-4" /> Print or save as PDF
    </button>
  );
}
