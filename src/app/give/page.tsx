import Link from "next/link";
import { ArrowRight, CalendarHeart, Sparkles } from "lucide-react";
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
      <Link
        href="/club"
        className="group mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-surface p-6 transition hover:border-accent/40 hover:shadow-md"
      >
        <span className="flex items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <CalendarHeart className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-semibold group-hover:text-accent">Make it monthly with Soup Club</span>
            <span className="text-sm text-muted">The agent prepares a basket every month; you approve it with one tap.</span>
          </span>
        </span>
        <ArrowRight className="h-5 w-5 text-muted transition group-hover:translate-x-1 group-hover:text-accent" />
      </Link>
    </div>
  );
}
