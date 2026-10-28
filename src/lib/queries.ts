import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/db/index.ts";

const urgencyRank = { high: 0, medium: 1, low: 2 } as const;

/** Needs that can still be funded, most urgent first. */
export async function getOpenNeeds() {
  const rows = await db.query.needs.findMany({
    where: (n, { eq }) => eq(n.status, "open"),
    with: { ngo: true, vendor: true, catalogItem: true },
  });
  return rows.sort(
    (a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency] || (a.deadline ?? "").localeCompare(b.deadline ?? ""),
  );
}

export async function getNeed(id: number) {
  if (!Number.isInteger(id)) return undefined;
  return db.query.needs.findFirst({
    where: (n, { eq }) => eq(n.id, id),
    with: {
      ngo: true,
      vendor: true,
      catalogItem: true,
      donations: {
        where: (d, { eq }) => eq(d.captured, true),
        orderBy: (d) => [desc(d.id)],
        limit: 10,
        with: { order: true },
      },
    },
  });
}

export type NeedWithRelations = NonNullable<Awaited<ReturnType<typeof getNeed>>>;
