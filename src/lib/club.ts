// Soup Club: a standing monthly budget. Each month the Giving Agent prepares a basket of urgent,
// verified needs; the member approves it with one PayPal tap (suppliers are paid directly as usual).
// Members manage everything through a private link — there are no logins.
import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { runAgent } from "./agent.ts";
import { formatUsd } from "./fees.ts";

export class ClubError extends Error {}

export const MIN_BUDGET_CENTS = 1000;
export const MAX_BUDGET_CENTS = 50_000;

export const currentMonth = (d = new Date()) => d.toISOString().slice(0, 7);

export async function joinClub(input: { name: string; monthlyBudgetCents: number; causes: string }) {
  const name = input.name.trim().slice(0, 60);
  const causes = input.causes.trim().slice(0, 300);
  if (!name) throw new ClubError("Tell us your first name");
  if (!causes) throw new ClubError("Tell us what you care about");
  if (!Number.isInteger(input.monthlyBudgetCents) || input.monthlyBudgetCents < MIN_BUDGET_CENTS || input.monthlyBudgetCents > MAX_BUDGET_CENTS) {
    throw new ClubError(`Choose a monthly budget between ${formatUsd(MIN_BUDGET_CENTS)} and ${formatUsd(MAX_BUDGET_CENTS)}`);
  }
  const [member] = await db
    .insert(schema.clubMembers)
    .values({ token: randomBytes(18).toString("base64url"), name, causes, monthlyBudgetCents: input.monthlyBudgetCents })
    .returning();
  return member;
}

export async function updateMember(token: string, patch: { monthlyBudgetCents?: number; causes?: string; active?: boolean }) {
  const member = await getMember(token);
  const next = {
    monthlyBudgetCents: patch.monthlyBudgetCents ?? member.monthlyBudgetCents,
    causes: (patch.causes ?? member.causes).trim().slice(0, 300),
    active: patch.active ?? member.active,
  };
  if (next.monthlyBudgetCents < MIN_BUDGET_CENTS || next.monthlyBudgetCents > MAX_BUDGET_CENTS) throw new ClubError("Budget out of range");
  if (!next.causes) throw new ClubError("Tell us what you care about");
  await db.update(schema.clubMembers).set(next).where(eq(schema.clubMembers.id, member.id));
}

export async function getMember(token: string) {
  const member = await db.query.clubMembers.findFirst({ where: (m, { eq }) => eq(m.token, token) });
  if (!member) throw new ClubError("This Soup Club link isn't valid");
  return member;
}

/**
 * Ask the Giving Agent for this month's basket. Keeps an existing basket unless `rebuild` is set
 * (a paid basket is never rebuilt). Last month's needs are passed in so gifts spread out over time.
 */
export async function prepareBasket(memberId: number, { rebuild = false } = {}) {
  const member = await db.query.clubMembers.findFirst({ where: (m, { eq }) => eq(m.id, memberId) });
  if (!member) throw new ClubError("Unknown member");
  const month = currentMonth();
  const existing = await db.query.clubBaskets.findFirst({
    where: (b, { and, eq }) => and(eq(b.memberId, memberId), eq(b.month, month)),
  });
  // A paid basket is final; a skipped one can be re-prepared if the member changes their mind.
  if (existing && (!rebuild || existing.status === "paid")) return existing;

  const previous = await db.query.clubBaskets.findMany({
    where: (b, { and, eq, ne }) => and(eq(b.memberId, memberId), ne(b.month, month), eq(b.status, "paid")),
    orderBy: (b) => [desc(b.month)],
    limit: 2,
  });
  const recentNeedIds = [...new Set(previous.flatMap((b) => b.items.map((i) => i.needId)))];

  const reply = await runAgent([
    {
      role: "user",
      text:
        `This is my Soup Club monthly basket. My budget is ${formatUsd(member.monthlyBudgetCents)}. ` +
        `I care about: ${member.causes}. Pick my basket now without asking me questions.` +
        (recentNeedIds.length ? ` Recently I funded need ids ${recentNeedIds.join(", ")}; prefer others unless they are the most urgent.` : ""),
    },
  ]);
  if (!reply.basket) throw new ClubError("The Giving Agent couldn't find needs that fit this month. Try a broader cause or budget.");

  const values = {
    memberId,
    month,
    items: reply.basket.items,
    // The agent's closing message explains the whole basket; the per-proposal note may only describe a revision.
    rationale: withoutApprovalPrompt(reply.text) || reply.basket.rationale,
    totalCents: reply.basket.totalCents,
    status: "ready" as const,
  };
  if (existing) {
    const [updated] = await db.update(schema.clubBaskets).set(values).where(eq(schema.clubBaskets.id, existing.id)).returning();
    return updated;
  }
  const [created] = await db.insert(schema.clubBaskets).values(values).returning();
  return created;
}

/** The page shows its own PayPal button, so drop the agent's closing "review and approve" sentence. */
function withoutApprovalPrompt(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/\b(approve|review the basket|review your basket)\b/i.test(sentence))
    .join(" ")
    .trim();
}

/** Prepare this month's basket for every active member who doesn't have one (run monthly by cron). */
export async function prepareDueBaskets() {
  const members = await db.query.clubMembers.findMany({ where: (m, { eq }) => eq(m.active, true) });
  const results = { prepared: 0, failed: 0 };
  for (const m of members) {
    try {
      await prepareBasket(m.id);
      results.prepared++;
    } catch (e) {
      console.error(`club basket for member ${m.id} failed`, e);
      results.failed++;
    }
  }
  return results;
}

export async function skipBasket(token: string) {
  const member = await getMember(token);
  await db
    .update(schema.clubBaskets)
    .set({ status: "skipped" })
    .where(and(eq(schema.clubBaskets.memberId, member.id), eq(schema.clubBaskets.month, currentMonth()), eq(schema.clubBaskets.status, "ready")));
}

/** Member dashboard: settings, this month's basket (with live need details) and past months' gifts. */
export async function getClubDashboard(token: string) {
  const member = await getMember(token);
  const baskets = await db.query.clubBaskets.findMany({
    where: (b, { eq }) => eq(b.memberId, member.id),
    orderBy: (b) => [desc(b.month)],
  });
  const needIds = [...new Set(baskets.flatMap((b) => b.items.map((i) => i.needId)))];
  const needs = needIds.length
    ? await db.query.needs.findMany({
        where: (n, { inArray }) => inArray(n.id, needIds),
        with: { ngo: true, vendor: true, catalogItem: true },
      })
    : [];
  return { member, baskets, needs, month: currentMonth() };
}
