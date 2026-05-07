import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { spending } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { mmFromIsoDate, toEuro } from "@/lib/fx";

export type SpendingInput = {
  transaction?: string | null;
  amount: number;
  currency: string;
  categoryId: string;
  chargeDate: string; // YYYY-MM-DD
  moneyDate?: string | null;
  method?: string | null;
  spendName?: string | null;
  status?: string | null;
  fxRate?: number | null;
};

export type SpendingFilter = {
  year?: number;
  month?: number; // 1..12
  categoryId?: string;
};

export async function listSpending(filter: SpendingFilter = {}) {
  await requireAuth();
  const conds = [] as Array<ReturnType<typeof eq>>;
  if (filter.categoryId) conds.push(eq(spending.categoryId, filter.categoryId));
  if (filter.month != null) conds.push(eq(spending.mm, filter.month));
  if (filter.year != null) {
    conds.push(like(spending.chargeDate, `${filter.year}-%`));
  }
  return db
    .select()
    .from(spending)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(spending.chargeDate), desc(spending.createdAt));
}

export async function getSpendingById(id: string) {
  await requireAuth();
  const [row] = await db.select().from(spending).where(eq(spending.id, id));
  return row ?? null;
}

function computeDerived(input: Pick<SpendingInput, "amount" | "currency" | "chargeDate" | "fxRate">) {
  return {
    mm: mmFromIsoDate(input.chargeDate),
    euroMoney: input.fxRate
      ? input.amount * input.fxRate
      : toEuro(input.amount, input.currency),
  };
}

function buildSpendingRow(input: SpendingInput) {
  const now = Date.now();
  const derived = computeDerived(input);
  return {
    id: randomUUID(),
    notionId: null,
    transaction: input.transaction ?? null,
    amount: input.amount,
    currency: input.currency,
    categoryId: input.categoryId,
    chargeDate: input.chargeDate,
    moneyDate: input.moneyDate ?? null,
    method: input.method ?? null,
    mm: derived.mm,
    euroMoney: derived.euroMoney,
    spendName: input.spendName ?? null,
    status: input.status ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Auth-gated create (used by the normal app). */
export async function createSpending(input: SpendingInput) {
  await requireAuth();
  const row = buildSpendingRow(input);
  await db.insert(spending).values(row);
  return row;
}

/** Public create (no auth check — used by /quick-spend). */
export async function createSpendingPublic(input: SpendingInput) {
  const row = buildSpendingRow(input);
  await db.insert(spending).values(row);
  return row;
}

export async function createSpendingBatch(rows: SpendingInput[]) {
  await requireAuth();
  if (rows.length === 0) return { inserted: 0, ids: [] as string[] };
  const now = Date.now();
  const mapped = rows.map((input) => {
    const derived = computeDerived(input);
    return {
      id: randomUUID(),
      notionId: null,
      transaction: input.transaction ?? null,
      amount: input.amount,
      currency: input.currency,
      categoryId: input.categoryId,
      chargeDate: input.chargeDate,
      moneyDate: input.moneyDate ?? null,
      method: input.method ?? null,
      mm: derived.mm,
      euroMoney: derived.euroMoney,
      spendName: input.spendName ?? null,
      status: input.status ?? null,
      createdAt: now,
      updatedAt: now,
    };
  });
  // One insert = one DB round-trip. No 350 ms/row rate-limit sleep.
  await db.insert(spending).values(mapped);
  return { inserted: mapped.length, ids: mapped.map((r) => r.id) };
}

export async function updateSpending(id: string, patch: Partial<SpendingInput>) {
  await requireAuth();
  const current = await getSpendingById(id);
  if (!current) return null;
  const merged = {
    amount: patch.amount ?? current.amount,
    currency: patch.currency ?? current.currency,
    chargeDate: patch.chargeDate ?? current.chargeDate,
    fxRate: patch.fxRate ?? null,
  };
  const derived = computeDerived(merged);
  const update: Record<string, unknown> = {
    updatedAt: Date.now(),
    mm: derived.mm,
    euroMoney: derived.euroMoney,
  };
  if (patch.transaction !== undefined) update.transaction = patch.transaction;
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.categoryId !== undefined) update.categoryId = patch.categoryId;
  if (patch.chargeDate !== undefined) update.chargeDate = patch.chargeDate;
  if (patch.moneyDate !== undefined) update.moneyDate = patch.moneyDate;
  if (patch.method !== undefined) update.method = patch.method;
  if (patch.spendName !== undefined) update.spendName = patch.spendName;
  if (patch.status !== undefined) update.status = patch.status;
  await db.update(spending).set(update).where(eq(spending.id, id));
  return getSpendingById(id);
}

export async function deleteSpending(id: string) {
  await requireAuth();
  const result = await db
    .delete(spending)
    .where(eq(spending.id, id))
    .returning({ id: spending.id });
  return result.length > 0;
}

export async function sumSpendingByMonth(year: number) {
  await requireAuth();
  return db
    .select({
      mm: spending.mm,
      total: sql<number>`COALESCE(SUM(${spending.euroMoney}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(spending)
    .where(like(spending.chargeDate, `${year}-%`))
    .groupBy(spending.mm)
    .orderBy(spending.mm);
}

/**
 * Cash-flow rollup: sum euro_money grouped by the month of the *due* date.
 * Falls back to charge_date when money_date is null. The effective date is
 * what hits cash flow in real life — settlement day, not transaction day.
 */
export async function sumSpendingByDueMonth(year: number) {
  await requireAuth();
  const effective = sql<string>`COALESCE(${spending.moneyDate}, ${spending.chargeDate})`;
  return db
    .select({
      mm: sql<number>`CAST(strftime('%m', ${effective}) AS INTEGER)`,
      total: sql<number>`COALESCE(SUM(${spending.euroMoney}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(spending)
    .where(sql`${effective} LIKE ${`${year}-%`}`)
    .groupBy(sql`CAST(strftime('%m', ${effective}) AS INTEGER)`)
    .orderBy(sql`CAST(strftime('%m', ${effective}) AS INTEGER)`);
}

export async function sumSpendingByCategory(year: number, month?: number) {
  await requireAuth();
  const conds = [like(spending.chargeDate, `${year}-%`)];
  if (month != null) conds.push(eq(spending.mm, month));
  return db
    .select({
      categoryId: spending.categoryId,
      total: sql<number>`COALESCE(SUM(${spending.euroMoney}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(spending)
    .where(and(...conds))
    .groupBy(spending.categoryId);
}
