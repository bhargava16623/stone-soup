// Gemini relevance pass for Channel3 price benchmarks.
// Keeps only results that are the requested item in a comparable single-unit size,
// so "white rice, 25 lb bag" doesn't get priced from tote bags and rice cookers.
import { Type } from "@google/genai";
import type { MarketSample, RelevanceFilter } from "./channel3.ts";
import { generateJson } from "./gemini.ts";

const SYSTEM = `You check product search results for a price comparison.
Keep a result if it is the same TYPE of product as the requested item and would be a
reasonable substitute for it (e.g. a throw or twin fleece blanket for "fleece blanket,
twin size"; a toothbrush+toothpaste set for "toothbrush and toothpaste travel kit").
Minor differences in size, color, brand or material are fine.
Reject results that are a different product that merely shares a word (rice cooker or
storage container for "rice"), accessories, pet products, and bulk packs clearly much
larger than one unit. When unsure, keep it. Return only the numbers of results to keep.`;

export const geminiRelevanceFilter: RelevanceFilter = async (item, samples) => {
  if (samples.length === 0) return samples;
  const list = samples.map((s, i) => `${i}. ${s.title} — $${s.price.toFixed(2)} (${s.domain})`).join("\n");
  const { data } = await generateJson<{ matching: number[] }>(
    `Requested item: ${item}\n\nResults:\n${list}`,
    {
      type: Type.OBJECT,
      properties: { matching: { type: Type.ARRAY, items: { type: Type.INTEGER } } },
      required: ["matching"],
    },
    { system: SYSTEM },
  );
  const keep = new Set(data.matching);
  return samples.filter((_: MarketSample, i: number) => keep.has(i));
};
