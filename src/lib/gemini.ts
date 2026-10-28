// Gemini access for all AI features (intake, relevance filter, verification, impact updates).
//
// The newest Flash models regularly return 503 "high demand" or hang, so every call
// goes through a fallback chain with a per-attempt timeout. The demo must not die
// because one model is overloaded. The API key is read from GEMINI_API_KEY (server-side only).
import { GoogleGenAI, type GenerateContentConfig, type Schema } from "@google/genai";

let client: GoogleGenAI | undefined;

function gemini(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/** Preferred model first. Override the first entry with GEMINI_MODEL. */
const MODELS = [process.env.GEMINI_MODEL ?? "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"];
const ATTEMPT_TIMEOUT_MS = 20_000;

/** Models that just failed with overload/timeout are skipped for a while instead of retried every call. */
const COOLDOWN_MS = 5 * 60_000;
const coolingUntil = new Map<string, number>();

function isTransient(e: unknown): boolean {
  const err = e as { status?: number; name?: string; message?: string };
  return err.status === 503 || err.status === 429 || err.name === "AbortError" || err.name === "TimeoutError" || /aborted|timed? ?out/i.test(err.message ?? "");
}

export interface GenerateOptions {
  system?: string;
  config?: Omit<GenerateContentConfig, "systemInstruction" | "abortSignal">;
}

export interface GenerateResult {
  text: string;
  model: string;
}

/** Generate text, falling through the model chain on overload, timeout, or empty output. */
export async function generate(
  contents: Parameters<GoogleGenAI["models"]["generateContent"]>[0]["contents"],
  { system, config }: GenerateOptions = {},
): Promise<GenerateResult> {
  const errors: string[] = [];
  const now = Date.now();
  const available = [...new Set(MODELS)].filter((m) => (coolingUntil.get(m) ?? 0) <= now);
  // If every model is cooling down, try them all anyway rather than failing outright.
  for (const model of available.length ? available : [...new Set(MODELS)]) {
    try {
      const res = await gemini().models.generateContent({
        model,
        contents,
        config: { ...config, systemInstruction: system, abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) },
      });
      if (res.text) return { text: res.text, model };
      errors.push(`${model}: empty response`);
    } catch (e) {
      if (isTransient(e)) coolingUntil.set(model, Date.now() + COOLDOWN_MS);
      errors.push(`${model}: ${(e as Error).message.slice(0, 120)}`);
    }
  }
  throw new Error(`All Gemini models failed:\n  ${errors.join("\n  ")}`);
}

/** Generate JSON that matches `schema` and parse it. */
export async function generateJson<T>(
  contents: Parameters<typeof generate>[0],
  schema: Schema,
  options: GenerateOptions = {},
): Promise<{ data: T; model: string }> {
  const { text, model } = await generate(contents, {
    ...options,
    config: { ...options.config, responseMimeType: "application/json", responseSchema: schema },
  });
  return { data: JSON.parse(text) as T, model };
}
