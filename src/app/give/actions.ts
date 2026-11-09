"use server";

import { runAgent, type AgentReply, type ChatMessage } from "@/lib/agent.ts";
import { limitAction, RateLimitError } from "@/lib/rate-limit.ts";

export async function agentAction(history: ChatMessage[]): Promise<{ ok: true; data: AgentReply } | { ok: false; error: string }> {
  try {
    await limitAction("agent", 12);
    const clean = history
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
      .slice(-12);
    if (clean.length === 0 || clean.at(-1)!.role !== "user") throw new Error("Say something to the agent first");
    return { ok: true, data: await runAgent(clean) };
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    console.error("agent failed", e);
    return { ok: false, error: "The Giving Agent is having trouble right now. Please try again in a moment." };
  }
}
