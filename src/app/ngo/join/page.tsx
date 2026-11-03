import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { NgoJoinForm } from "@/components/ngo-join-form.tsx";
import { PageHeader } from "@/components/page-header.tsx";

export const metadata: Metadata = { title: "Register your charity · Stone Soup" };

export default function JoinPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader icon={ShieldCheck} eyebrow="For organisations" title="Register your charity">
        Stone Soup never makes a page for a charity on its own, and no one can post needs in your name without proving they
        run your charity. It takes two minutes.
      </PageHeader>
      <NgoJoinForm />
    </div>
  );
}
