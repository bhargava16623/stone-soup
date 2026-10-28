import { Sparkles } from "lucide-react";
import { GivingAgent } from "@/components/giving-agent.tsx";
import { PageHeader } from "@/components/page-header.tsx";

export default function GivePage() {
  return (
    <div>
      <PageHeader icon={Sparkles} eyebrow="AI-powered giving" title="Tell the Giving Agent what you care about">
        It finds open needs, builds a basket within your budget, and you approve it once in PayPal. Every supplier is paid
        directly.
      </PageHeader>
      <GivingAgent />
    </div>
  );
}
