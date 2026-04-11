import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { budget } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { mmFromIsoDate, toEuro } from "@/lib/fx";

export type BudgetInput = {
  transaction?: string | null;
  amount: number;
  currency: string;
  categoryId: string;
  chargeDate: string;
  status?: string | null;
};

export type BudgetFilter = {
  year?: number;
  month?: number;
  categoryId?: string;
};

export async function listBudget(filter: BudgetFilter = {}) {
  await requireAuth();
  const conds = [] as Array<ReturnType<typeof eq>>;
  if (filter.categoryId) conds.push(eq(budget.categoryId, filter.categoryId));
  if (filter.month != null) conds.push(eq(budget.mm, filter.month));
  if (filter.year != null) conds.push(like(budget.chargeDate, `${filter.year}-%`));
  return db
    .select()
    .from(budget)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(budget.chargeDate), desc(budget.createdAt));
}

export async function getBudgetById(id: string) {
  await requireAuth();
  const [row] = await db.select().from(budget).where(eq(budget.id, id));
  return row ?? null;
}

function derive(input: Pick<BudgetInput, "amount" | "currency" | "chargeDate">) {
  return {
    mm: mmFromIsoDate(input.chargeDate),
    euroMoney: toEuro(input.amount, input.currency),
  };
}

export async function createBudget(input: BudgetInput) {
  await requireAuth();
  const now = Date.now();
  const d = derive(input);
  const row = {
    id: randomUUID(),
    notionId: null,
    transaction: input.transaction ?? null,
    amount: input.amount,
    currency: input.currency,
    categoryId: input.categoryId,
    chargeDate: input.chargeDate,
    mm: d.mm,
    euroMoney: d.euroMoney,
    status: input.status ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(budget).values(row);
  return row;
}

export async function updateBudget(id: string, patch: Partial<BudgetInput>) {
  await requireAuth();
  const current = await getBudgetById(id);
  if (!current) return null;
  const merged = {
    amount: patch.amount ?? current.amount,
    currency: patch.currency ?? current.currency,
    chargeDate: patch.chargeDate ?? current.chargeDate,
  };
  const d = derive(merged);
  const update: Record<string, unknown> = {
    updatedAt: Date.now(),
    mm: d.mm,
    euroMoney: d.euroMoney,
  };
  if (patch.transaction !== undefined) update.transaction = patch.transaction;
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.categoryId !== undefined) update.categoryId = patch.categoryId;
  if (patch.chargeDate !== undefined) update.chargeDate = patch.chargeDate;
  if (patch.status !== undefined) update.status = patch.status;
  await db.update(budget).set(update).where(eq(budget.id, id));
  return getBudgetById(id);
}

export async function deleteBudget(id: string) {
  await requireAuth();
  const result = await db
    .delete(budget)
    .where(eq(budget.id, id))
    .returning({ id: budget.id });
  return result.length > 0;
}

export async function sumBudgetByMonth(year: number) {
  await requireAuth();
  return db
    .select({
      mm: budget.mm,
      total: sql<number>`COALESCE(SUM(${budget.euroMoney}), 0)`,
    })
    .from(budget)
    .where(like(budget.chargeDate, `${year}-%`))
    .groupBy(budget.mm)
    .orderBy(budget.mm);
}
