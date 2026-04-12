import "server-only";
import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { budget, categories, spending } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export type BudgetVsSpendRow = {
  categoryId: string;
  categoryName: string;
  budgetEur: number;
  spendingEur: number;
  diff: number;
  pctUsed: number | null;
};

export type CategoryDrillDown = {
  items: Array<{
    id: string;
    kind: "spending" | "budget";
    transaction: string | null;
    amount: number;
    currency: string;
    euroMoney: number;
    chargeDate: string;
  }>;
};

export async function getBudgetVsSpending(
  year: number,
  month?: number,
): Promise<BudgetVsSpendRow[]> {
  await requireAuth();

  const yearLike = `${year}-%`;
  const spendConds = [like(spending.chargeDate, yearLike)];
  const budgetConds = [like(budget.chargeDate, yearLike)];
  if (month != null) {
    spendConds.push(eq(spending.mm, month));
    budgetConds.push(eq(budget.mm, month));
  }

  const [spendByCat, budgetByCat, cats] = await Promise.all([
    db
      .select({
        categoryId: spending.categoryId,
        total: sql<number>`COALESCE(SUM(${spending.euroMoney}), 0)`,
      })
      .from(spending)
      .where(and(...spendConds))
      .groupBy(spending.categoryId),
    db
      .select({
        categoryId: budget.categoryId,
        total: sql<number>`COALESCE(SUM(${budget.euroMoney}), 0)`,
      })
      .from(budget)
      .where(and(...budgetConds))
      .groupBy(budget.categoryId),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.name)),
  ]);

  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const spendMap = new Map(spendByCat.map((r) => [r.categoryId, Number(r.total)]));
  const budgetMap = new Map(budgetByCat.map((r) => [r.categoryId, Number(r.total)]));

  const allCatIds = new Set([...spendMap.keys(), ...budgetMap.keys()]);
  const rows: BudgetVsSpendRow[] = [];
  for (const cid of allCatIds) {
    const b = budgetMap.get(cid) ?? 0;
    const s = spendMap.get(cid) ?? 0;
    rows.push({
      categoryId: cid,
      categoryName: catName.get(cid) ?? "Unknown",
      budgetEur: b,
      spendingEur: s,
      diff: b - s,
      pctUsed: b > 0 ? (s / b) * 100 : null,
    });
  }
  rows.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  return rows;
}

export async function getCategoryDrillDown(
  categoryId: string,
  year: number,
  month?: number,
): Promise<CategoryDrillDown> {
  await requireAuth();

  const yearLike = `${year}-%`;
  const spendConds = [
    eq(spending.categoryId, categoryId),
    like(spending.chargeDate, yearLike),
  ];
  const budgetConds = [
    eq(budget.categoryId, categoryId),
    like(budget.chargeDate, yearLike),
  ];
  if (month != null) {
    spendConds.push(eq(spending.mm, month));
    budgetConds.push(eq(budget.mm, month));
  }

  const [sRows, bRows] = await Promise.all([
    db
      .select({
        id: spending.id,
        transaction: spending.transaction,
        amount: spending.amount,
        currency: spending.currency,
        euroMoney: spending.euroMoney,
        chargeDate: spending.chargeDate,
      })
      .from(spending)
      .where(and(...spendConds))
      .orderBy(desc(spending.chargeDate)),
    db
      .select({
        id: budget.id,
        transaction: budget.transaction,
        amount: budget.amount,
        currency: budget.currency,
        euroMoney: budget.euroMoney,
        chargeDate: budget.chargeDate,
      })
      .from(budget)
      .where(and(...budgetConds))
      .orderBy(desc(budget.chargeDate)),
  ]);

  return {
    items: [
      ...sRows.map((r) => ({
        id: r.id,
        kind: "spending" as const,
        transaction: r.transaction,
        amount: r.amount,
        currency: r.currency,
        euroMoney: r.euroMoney ?? 0,
        chargeDate: r.chargeDate,
      })),
      ...bRows.map((r) => ({
        id: r.id,
        kind: "budget" as const,
        transaction: r.transaction,
        amount: r.amount,
        currency: r.currency,
        euroMoney: r.euroMoney ?? 0,
        chargeDate: r.chargeDate,
      })),
    ],
  };
}
