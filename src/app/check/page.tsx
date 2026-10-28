import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header.tsx";
import { ScamCheckForm } from "@/components/scam-check-form.tsx";

export default function ScamCheckPage() {
  return (
    <div>
      <PageHeader icon={ShieldCheck} eyebrow="Scam Check" title="Is this donation appeal real?">
        Fake charities spike after every disaster, and AI makes them look convincing. Paste a link, a message or a screenshot
        from anywhere — we research it on the web and tell you what to look out for.
      </PageHeader>
      <ScamCheckForm />
    </div>
  );
}
