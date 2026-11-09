import Link from "next/link";
import { SearchX } from "lucide-react";
import { PageHeader } from "@/components/page-header.tsx";

export default function NotFound() {
  return (
    <div className="py-10">
      <PageHeader icon={SearchX} eyebrow="Not found" title="We couldn't find that page">
        The link may be mistyped, or the need, pot or gift may no longer exist.
      </PageHeader>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="rounded-full bg-accent px-5 py-2 font-medium text-white transition hover:opacity-90">
          See open needs
        </Link>
        <Link href="/ledger" className="rounded-full border border-border px-5 py-2 font-medium transition hover:bg-surface">
          Open the public ledger
        </Link>
      </div>
    </div>
  );
}
