import { GivingAgent } from "@/components/giving-agent.tsx";

export default function GivePage() {
  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <h1 className="font-serif text-3xl font-semibold">Giving Agent</h1>
        <p className="mt-2 text-muted">
          Tell it your budget and what you care about. It finds open needs, builds a basket within your budget, and you approve
          it once in PayPal. Every supplier is paid directly.
        </p>
      </header>
      <GivingAgent />
    </div>
  );
}
