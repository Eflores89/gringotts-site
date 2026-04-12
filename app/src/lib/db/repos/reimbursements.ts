import "server-only";
import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { spendingReimbursements } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { toEuro } from "@/lib/fx";

export type ReimbursementInput = {
  spendingId: string;
  amount: number;
  currency: string;
  description?: string | null;
  reimbursedDate?: string | null;
  fxRate?: number | null;
};

export async function listReimbursements(spendingId: string) {
  await requireAuth();
  return db
    .select()
    .from(spendingReimbursements)
    .where(eq(spendingReimbursements.spendingId, spendingId))
    .orderBy(asc(spendingReimbursements.createdAt));
}

export async function createReimbursement(input: ReimbursementInput) {
  await requireAuth();
  const now = Date.now();
  const row = {
    id: randomUUID(),
    spendingId: input.spendingId,
    amount: input.amount,
    currency: input.currency,
    euroMoney: input.fxRate
      ? input.amount * input.fxRate
      : toEuro(input.amount, input.currency),
    description: input.description ?? null,
    reimbursedDate: input.reimbursedDate ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(spendingReimbursements).values(row);
  return row;
}

export async function deleteReimbursement(id: string) {
  await requireAuth();
  const result = await db
    .delete(spendingReimbursements)
    .where(eq(spendingReimbursements.id, id))
    .returning({ id: spendingReimbursements.id });
  return result.length > 0;
}

export async function totalReimbursed(spendingId: string): Promise<number> {
  await requireAuth();
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${spendingReimbursements.euroMoney}), 0)` })
    .from(spendingReimbursements)
    .where(eq(spendingReimbursements.spendingId, spendingId));
  return Number(row?.total ?? 0);
}
