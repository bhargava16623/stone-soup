// Scam Check: assess a donation appeal seen anywhere (link, pasted text or screenshot).
// Step 1 researches it on the web with Gemini + Google Search grounding (best effort);
// step 2 produces a structured assessment and suggests verified Stone Soup needs for the same cause.
// Nothing the visitor submits is stored.
import "server-only";
import { Type, type Part } from "@google/genai";
import { generateJson, generateResponse } from "./gemini.ts";
import { getOpenNeeds } from "./queries.ts";
import { fetchPublicPage, type FetchedPage } from "./safe-fetch.ts";

export interface ScamCheckInput {
  url?: string;
  text?: string;
  image?: { base64: string; mimeType: string };
}

export interface ScamCheckResult {
  risk: "low" | "medium" | "high";
  headline: string;
  redFlags: { flag: string; evidence: string }[];
  reassuring: string[];
  howToVerify: string[];
  cause: string;
  sources: { title: string; url: string }[];
  researched: boolean; // false if web research was unavailable
  page?: { url: string; title: string };
  suggestedNeedIds: number[];
}

// Web search grounding is available on this model with the free tier; others return 429.
const RESEARCH_MODEL = "gemini-2.5-flash";

const RESEARCH_PROMPT = `Research this donation appeal on the web for someone deciding whether to give.
Find: who is asking (organisation or person) and whether they are a registered charity; any news,
warnings or scam reports about them or this kind of appeal; whether the cause or event is real.
Be factual and say clearly when you could not find something. Under 200 words.`;

const ASSESS_PROMPT = `You help people avoid donation scams, including AI-generated ones. Assess the appeal below
using the content and the web research. Common red flags: urgency and pressure; payment by gift card, crypto,
wire transfer or personal accounts; no verifiable registered organisation; copycat names of known charities;
emotional stock or AI-looking images; claims that can't be checked; very new or mismatched websites; asking
for personal or bank details. Absence of evidence is not proof of a scam: use "medium" when unsure.
- risk: low / medium / high
- headline: one plain sentence verdict for a non-expert
- redFlags: specific concerns, each with the evidence from the content or research (empty if none)
- reassuring: specific signs of legitimacy found (empty if none)
- howToVerify: 2–4 concrete steps the person can take (e.g. look up the registration number on the
  official charity register, donate via the organisation's own site)
- cause: two to five words describing what the money is for (e.g. "winter shelter supplies")
- suggestedNeedIds: up to 3 ids from the verified needs list that serve a similar cause (empty if none fit)`;

export async function checkAppeal(input: ScamCheckInput): Promise<ScamCheckResult> {
  if (!input.url?.trim() && !input.text?.trim() && !input.image) throw new Error("Paste a link, some text or a screenshot");

  let page: FetchedPage | undefined;
  let pageError: string | undefined;
  if (input.url?.trim()) {
    try {
      page = await fetchPublicPage(input.url);
    } catch (e) {
      // Many fundraising sites block automated reading; we still assess the link itself.
      pageError = e instanceof Error ? e.message : "Could not read the page";
    }
  }

  const contentParts: Part[] = [];
  const described = [
    input.url && `Link: ${input.url}`,
    page && `Page title: ${page.title}\nPage description: ${page.description}\nPage text: ${page.text}`,
    pageError && `(The page could not be read: ${pageError})`,
    input.text?.trim() && `Appeal text:\n"""${input.text.trim().slice(0, 6000)}"""`,
    input.image && "A screenshot of the appeal is attached.",
  ]
    .filter(Boolean)
    .join("\n\n");
  if (input.image) contentParts.push({ inlineData: { data: input.image.base64, mimeType: input.image.mimeType } });
  contentParts.push({ text: described });

  // Step 1: grounded research (best effort).
  let research = "";
  let sources: ScamCheckResult["sources"] = [];
  try {
    const { response } = await generateResponse(
      [{ role: "user", parts: [...contentParts, { text: RESEARCH_PROMPT }] }],
      { config: { tools: [{ googleSearch: {} }] } },
      { model: RESEARCH_MODEL, usable: (r) => Boolean(r.text) },
    );
    research = response.text ?? "";
    const seen = new Set<string>();
    sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
      .map((c) => ({ title: c.web?.title ?? "", url: c.web?.uri ?? "" }))
      .filter((s) => s.url && s.title && !seen.has(s.title) && seen.add(s.title))
      .slice(0, 6);
  } catch (e) {
    console.warn("scam-check research unavailable", e);
  }

  // Step 2: structured assessment, with the verified needs to suggest.
  const needs = await getOpenNeeds();
  const needsList = needs.map((n) => `id ${n.id}: ${n.title} — ${n.ngo.name}, ${n.ngo.city}`).join("\n");
  const { data } = await generateJson<Omit<ScamCheckResult, "sources" | "researched" | "page">>(
    [
      {
        role: "user",
        parts: [
          ...contentParts,
          { text: `Web research:\n${research || "(not available)"}\n\nVerified needs on Stone Soup:\n${needsList}` },
        ],
      },
    ],
    {
      type: Type.OBJECT,
      properties: {
        risk: { type: Type.STRING, enum: ["low", "medium", "high"] },
        headline: { type: Type.STRING },
        redFlags: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { flag: { type: Type.STRING }, evidence: { type: Type.STRING } },
            required: ["flag", "evidence"],
          },
        },
        reassuring: { type: Type.ARRAY, items: { type: Type.STRING } },
        howToVerify: { type: Type.ARRAY, items: { type: Type.STRING } },
        cause: { type: Type.STRING },
        suggestedNeedIds: { type: Type.ARRAY, items: { type: Type.INTEGER } },
      },
      required: ["risk", "headline", "redFlags", "reassuring", "howToVerify", "cause", "suggestedNeedIds"],
    },
    { system: ASSESS_PROMPT },
  );

  const validIds = new Set(needs.map((n) => n.id));
  return {
    ...data,
    redFlags: data.redFlags.slice(0, 6),
    reassuring: data.reassuring.slice(0, 5),
    howToVerify: data.howToVerify.slice(0, 4),
    suggestedNeedIds: data.suggestedNeedIds.filter((id) => validIds.has(id)).slice(0, 3),
    sources,
    researched: Boolean(research),
    page: page ? { url: page.url, title: page.title } : undefined,
  };
}
