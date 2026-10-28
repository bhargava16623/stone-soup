import { CalendarHeart, Camera, PackageCheck, Sparkles } from "lucide-react";
import { ClubJoinForm } from "@/components/club-join-form.tsx";
import { PageHeader } from "@/components/page-header.tsx";

const POINTS = [
  { icon: Sparkles, title: "The agent picks", text: "Each month the Giving Agent chooses urgent, fairly priced needs that match what you care about." },
  { icon: PackageCheck, title: "You approve once", text: "One PayPal tap pays every supplier directly. Skip or change your mind any month." },
  { icon: Camera, title: "You see it arrive", text: "A monthly digest with delivery photos and a note about each gift." },
];

export default function ClubPage() {
  return (
    <div>
      <PageHeader icon={CalendarHeart} eyebrow="Soup Club" title="A little in the pot, every month">
        Most first-time donors never give again — not because they stop caring, but because nobody makes it easy or shows them
        what happened. Soup Club does both.
      </PageHeader>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <ul className="space-y-4 self-start">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4 rounded-3xl border border-border bg-surface p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="text-sm text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <ClubJoinForm />
      </div>
    </div>
  );
}
