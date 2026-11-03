import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BadgeCheck, Clock, ShieldCheck } from "lucide-react";
import { CheckWebsiteButton } from "@/components/check-website-button.tsx";
import { CopyText } from "@/components/copy-text.tsx";
import { PageHeader } from "@/components/page-header.tsx";
import { db } from "@/db/index.ts";
import { formatEin } from "@/lib/verify.ts";

export default function VerifyPage({ params }: PageProps<"/ngo/[slug]/verify">) {
  return (
    <div className="max-w-2xl">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Verify params={params} />
      </Suspense>
    </div>
  );
}

async function Verify({ params }: { params: PageProps<"/ngo/[slug]/verify">["params"] }) {
  const { slug } = await params;
  const ngo = await db.query.ngos.findFirst({ where: (n, { eq }) => eq(n.slug, slug) });
  if (!ngo) notFound();

  if (ngo.status === "demo") {
    return (
      <PageHeader icon={ShieldCheck} eyebrow="Verification" title={`${ngo.name} is a demo charity`}>
        It&apos;s fictional and was set up for this demo, so it has no IRS record to check.{" "}
        <Link href="/ngo/join" className="text-accent hover:underline">
          Register a real charity
        </Link>
        .
      </PageHeader>
    );
  }

  const v = ngo.verification;
  return (
    <div className="space-y-6">
      <PageHeader icon={ShieldCheck} eyebrow="Verification" title={`Prove you run ${ngo.name}`}>
        Until this is done, nothing can be posted or donated in your charity&apos;s name.
      </PageHeader>

      <Step done title="Registered with the IRS">
        {ngo.irsName} · {ngo.irsLocation} · EIN {ngo.ein && formatEin(ngo.ein)} · 501(c)(3)
      </Step>

      <Step done={ngo.status !== "unverified"} title={`Show you control ${ngo.website}`}>
        {ngo.status === "unverified" ? (
          <div className="mt-3 space-y-4">
            <p>Do one of these, publish the change, then press the button. You can remove it once you&apos;re verified.</p>
            <div>
              <p className="font-medium text-foreground">Add this tag inside your home page&apos;s &lt;head&gt;</p>
              <div className="mt-2">
                <CopyText text={`<meta name="stone-soup-verification" content="${ngo.verifyToken}">`} />
              </div>
            </div>
            <div>
              <p className="font-medium text-foreground">
                Or create <code>{ngo.website}/.well-known/stone-soup.txt</code> containing
              </p>
              <div className="mt-2">
                <CopyText text={ngo.verifyToken ?? ""} />
              </div>
            </div>
            <CheckWebsiteButton ngoSlug={ngo.slug} />
          </div>
        ) : (
          v && <p>Found your code at {v.checkedUrl}.</p>
        )}
      </Step>

      {ngo.status !== "unverified" && v && (
        <Step done={ngo.status === "verified"} title={ngo.status === "verified" ? "Confirmed as your official website" : "A person is confirming it's your official website"}>
          <p>{v.evidence}</p>
          {v.sources.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {v.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Step>
      )}

      {ngo.status === "verified" && (
        <Link href={`/ngo/${ngo.slug}`} className="inline-flex rounded-full bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110">
          Go to your dashboard and post your first need
        </Link>
      )}
    </div>
  );
}

function Step({ done, title, children }: { done: boolean; title: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-3xl border bg-surface p-6 ${done ? "border-leaf/40" : "border-border"}`}>
      <h2 className="flex items-center gap-2 font-semibold">
        {done ? <BadgeCheck className="h-5 w-5 text-leaf" /> : <Clock className="h-5 w-5 text-muted" />}
        {title}
      </h2>
      <div className="mt-1 text-sm text-muted">{children}</div>
    </section>
  );
}
