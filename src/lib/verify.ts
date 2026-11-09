// Charity verification: no one can post needs in a charity's name without proving they run it.
// 1. The EIN must belong to an IRS-registered 501(c)(3) (ProPublica Nonprofit Explorer, IRS data).
// 2. The charity proves it controls its website by publishing a code we give it.
// 3. Gemini with Google Search checks that this website is that charity's official one; if it
//    can't confirm it, a person reviews the claim. Nothing is auto-approved on a guess.
import "server-only";
import { randomBytes } from "node:crypto";
import { Type } from "@google/genai";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import type { NgoVerification } from "@/db/schema.ts";
import { generateJson, generateResponse } from "./gemini.ts";
import { fetchPublicPage, FetchRefused } from "./safe-fetch.ts";

export class VerifyError extends Error {}

export interface IrsRecord {
  ein: string; // 9 digits
  name: string;
  city: string;
  state: string;
  is501c3: boolean;
  since: string | null; // IRS ruling year
}

export const formatEin = (ein: string) => `${ein.slice(0, 2)}-${ein.slice(2)}`;

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** Look an EIN up in the IRS exempt-organisations data, via ProPublica's Nonprofit Explorer API. */
export async function lookupEin(raw: string): Promise<IrsRecord> {
  const ein = raw.replace(/\D/g, "");
  if (ein.length !== 9) throw new VerifyError("An EIN has 9 digits, like 12-3456789");
  const res = await fetch(`https://projects.propublica.org/nonprofits/api/v2/organizations/${ein}.json`, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  }).catch(() => {
    throw new VerifyError("The IRS records lookup didn't respond. Try again in a moment.");
  });
  if (res.status === 404) throw new VerifyError("No registered nonprofit has that EIN");
  if (!res.ok) throw new VerifyError("The IRS records lookup didn't respond. Try again in a moment.");
  const { organization: o } = (await res.json()) as {
    organization: { name: string; city: string; state: string; subsection_code: number; ruling_date: string | null };
  };
  return {
    ein,
    name: titleCase(o.name),
    city: titleCase(o.city),
    state: o.state,
    is501c3: o.subsection_code === 3,
    since: o.ruling_date?.slice(0, 4) ?? null,
  };
}

function normaliseWebsite(raw: string): string {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new VerifyError("Enter your website, like hopeshelter.org");
  }
  if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) throw new VerifyError("Enter your website, like hopeshelter.org");
  return url.origin;
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "charity";
}

export interface RegisterInput {
  ein: string;
  name: string;
  website: string;
  paypalEmail: string;
  description: string;
}

/** Create an unverified charity. It can't post needs until checkWebsite verifies it. */
export async function registerNgo(input: RegisterInput) {
  const record = await lookupEin(input.ein);
  if (!record.is501c3) throw new VerifyError(`${record.name} is not registered as a 501(c)(3) charity, so it can't receive gifts here`);
  const existing = await db.query.ngos.findFirst({ where: (n, { eq }) => eq(n.ein, record.ein) });
  if (existing) {
    throw new VerifyError(
      `${record.name} is already on Stone Soup. If you didn't set it up, please tell us and we'll take it down; no one can post needs in a charity's name without proving they run it.`,
    );
  }
  const website = normaliseWebsite(input.website);
  const name = input.name.trim().slice(0, 80) || record.name;
  const description = input.description.trim().slice(0, 300);
  if (!description) throw new VerifyError("Add one sentence about what you do");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.paypalEmail.trim())) throw new VerifyError("Enter the email of your PayPal account");

  let slug = slugify(name);
  if (await db.query.ngos.findFirst({ where: (n, { eq }) => eq(n.slug, slug) })) slug = `${slug}-${randomBytes(2).toString("hex")}`;

  const [ngo] = await db
    .insert(schema.ngos)
    .values({
      slug,
      name,
      city: record.city,
      country: "US",
      description,
      paypalEmail: input.paypalEmail.trim(),
      ein: record.ein,
      irsName: record.name,
      irsLocation: `${record.city}, ${record.state}`,
      website,
      verifyToken: `stone-soup-${randomBytes(12).toString("base64url")}`,
    })
    .returning();
  return ngo;
}

/** Find the charity's code on its website: a meta tag on the home page, or /.well-known/stone-soup.txt. */
async function findToken(website: string, token: string): Promise<Pick<NgoVerification, "method" | "checkedUrl"> | null> {
  const file = `${website}/.well-known/stone-soup.txt`;
  const tries: [NgoVerification["method"], string][] = [
    ["well_known_file", file],
    ["meta_tag", website],
  ];
  for (const [method, url] of tries) {
    try {
      const page = await fetchPublicPage(url);
      // Redirects are followed, but the code must still be on the charity's own domain.
      if (new URL(page.url).hostname.replace(/^www\./, "") !== new URL(website).hostname.replace(/^www\./, "")) continue;
      if (page.verificationMeta === token || page.text.includes(token)) return { method, checkedUrl: page.url };
    } catch (e) {
      if (!(e instanceof FetchRefused)) throw e;
    }
  }
  return null;
}

// Google Search grounding works on this model with the free tier.
const RESEARCH_MODEL = "gemini-2.5-flash";

/** Is this website the official site of the IRS-registered organisation? Searches the web. */
async function researchOfficialSite(irsName: string, location: string, ein: string, website: string) {
  const host = new URL(website).hostname.replace(/^www\./, "");
  let research = "";
  let sources: NgoVerification["sources"] = [];
  try {
    const { response } = await generateResponse(
      [
        {
          role: "user",
          parts: [
            {
              // The EIN is left out on purpose: with it, grounded search returns no answer (finish reason OTHER).
              text: `Find the official website of the charity "${irsName}" (${location}). Is it ${host}?
Search the web and answer in under 120 words, saying which domain the charity itself uses.`,
            },
          ],
        },
      ],
      { config: { tools: [{ googleSearch: {} }] } },
      { model: RESEARCH_MODEL, usable: (r) => Boolean(r.text) },
    );
    research = response.text ?? "";
    const seen = new Set<string>();
    sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
      .map((c) => ({ title: c.web?.title ?? "", url: c.web?.uri ?? "" }))
      .filter((s) => s.url && s.title && !seen.has(s.title) && seen.add(s.title))
      .slice(0, 5);
  } catch (e) {
    console.warn("official-site research unavailable", e);
  }
  if (!research) return { official: "unsure" as const, evidence: "Web research was unavailable, so a person will check.", sources };

  const { data } = await generateJson<{ official: NgoVerification["official"]; evidence: string }>(
    `Website: ${host}\nOrganisation: ${irsName}, ${location}, EIN ${formatEin(ein)}\n\nWeb research:\n${research}`,
    {
      type: Type.OBJECT,
      properties: {
        official: { type: Type.STRING, enum: ["yes", "no", "unsure"] },
        evidence: { type: Type.STRING },
      },
      required: ["official", "evidence"],
    },
    {
      system: `Decide whether the website belongs to this organisation, from the research only.
"yes" only if the research links this domain to this organisation (same name and place). "no" if it shows the
domain belongs to someone else or the organisation's official site is a different domain. Otherwise "unsure".
evidence: one or two plain sentences explaining why.`,
    },
  );
  return { ...data, sources };
}

/** Check the code on the charity's website and decide: verified, or a person reviews it. */
export async function checkWebsite(slug: string) {
  const ngo = await db.query.ngos.findFirst({ where: (n, { eq }) => eq(n.slug, slug) });
  if (!ngo) throw new VerifyError("Unknown organisation");
  if (ngo.status !== "unverified") return ngo;
  if (!ngo.website || !ngo.verifyToken || !ngo.ein || !ngo.irsName) throw new VerifyError("This organisation was not registered with an EIN");

  const found = await findToken(ngo.website, ngo.verifyToken);
  if (!found) {
    throw new VerifyError(`We couldn't find your code on ${ngo.website} yet. Add it, publish the change, and check again.`);
  }
  const research = await researchOfficialSite(ngo.irsName, ngo.irsLocation ?? ngo.city, ngo.ein, ngo.website);
  const verified = research.official === "yes";
  const [updated] = await db
    .update(schema.ngos)
    .set({
      status: verified ? "verified" : "review",
      verifiedAt: verified ? new Date() : null,
      verification: { ...found, ...research },
    })
    .where(eq(schema.ngos.id, ngo.id))
    .returning();
  return updated;
}

/** Charities whose website check passed but whose official site a person must confirm. */
export async function getCharitiesToReview() {
  return db.query.ngos.findMany({ where: (n, { eq }) => eq(n.status, "review") });
}

/** A reviewer confirmed the website is the charity's own. Only charities waiting for review can be approved. */
export async function approveCharity(id: number) {
  const [ngo] = await db
    .update(schema.ngos)
    .set({ status: "verified", verifiedAt: new Date() })
    .where(and(eq(schema.ngos.id, id), eq(schema.ngos.status, "review")))
    .returning({ id: schema.ngos.id });
  if (!ngo) throw new VerifyError("This charity isn't waiting for review");
}

/** Whether a charity may post needs and receive gifts. */
export const canPostNeeds = (status: string) => status === "verified" || status === "demo";
