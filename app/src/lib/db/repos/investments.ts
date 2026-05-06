import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, getTableColumns, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { allocationInvestments, investments } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export type InvestmentInput = {
  name: string;
  ticker?: string | null;
  quantity?: number | null;
  purchasePrice?: number | null;
  purchaseDate?: string | null;
  currentPrice?: number | null;
  currency?: string | null;
  assetType?: string | null;
  vestDate?: string | null;
  notes?: string | null;
  annualGrowthRate?: number | null;
};

export type InvestmentFilter = {
  assetType?: string;
  currency?: string;
  vestedOnly?: boolean;
};

export async function listInvestments(filter: InvestmentFilter = {}) {
  await requireAuth();
  const conds = [] as Array<ReturnType<typeof eq>>;
  if (filter.assetType) conds.push(eq(investments.assetType, filter.assetType));
  if (filter.currency) conds.push(eq(investments.currency, filter.currency));
  // vestedOnly = vest_date is null OR vest_date <= today
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select({
      ...getTableColumns(investments),
      allocationCount:
        sql<number>`count(${allocationInvestments.allocationId})`.as(
          "allocation_count",
        ),
    })
    .from(investments)
    .leftJoin(
      allocationInvestments,
      eq(allocationInvestments.investmentId, investments.id),
    )
    .where(
      filter.vestedOnly
        ? and(
            ...conds,
            sql`(${investments.vestDate} IS NULL OR ${investments.vestDate} <= ${today})`,
          )
        : conds.length
          ? and(...conds)
          : undefined,
    )
    .groupBy(investments.id)
    .orderBy(asc(investments.name));
}

export async function getInvestmentById(id: string) {
  await requireAuth();
  const [row] = await db
    .select()
    .from(investments)
    .where(eq(investments.id, id));
  return row ?? null;
}

export async function createInvestment(input: InvestmentInput) {
  await requireAuth();
  const now = Date.now();
  const row = {
    id: randomUUID(),
    notionId: null,
    name: input.name,
    ticker: input.ticker ?? null,
    quantity: input.quantity ?? null,
    purchasePrice: input.purchasePrice ?? null,
    purchaseDate: input.purchaseDate ?? null,
    currentPrice: input.currentPrice ?? null,
    currency: input.currency ?? null,
    assetType: input.assetType ?? null,
    vestDate: input.vestDate ?? null,
    lastPriceUpdate: null,
    notes: input.notes ?? null,
    annualGrowthRate: input.annualGrowthRate ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(investments).values(row);
  return row;
}

export async function updateInvestment(
  id: string,
  patch: Partial<InvestmentInput>,
) {
  await requireAuth();
  const update: Record<string, unknown> = { updatedAt: Date.now() };
  for (const k of [
    "name",
    "ticker",
    "quantity",
    "purchasePrice",
    "purchaseDate",
    "currentPrice",
    "currency",
    "assetType",
    "vestDate",
    "notes",
    "annualGrowthRate",
  ] as const) {
    if (patch[k] !== undefined) update[k] = patch[k];
  }
  await db.update(investments).set(update).where(eq(investments.id, id));
  return getInvestmentById(id);
}

export async function deleteInvestment(id: string) {
  await requireAuth();
  // allocation_investments cascades on delete; allocations themselves
  // remain (they may apply to other holdings) — orphans are cleaned by
  // the user from /allocations.
  const result = await db
    .delete(investments)
    .where(eq(investments.id, id))
    .returning({ id: investments.id });
  return result.length > 0;
}

// Asset types whose tickers are meaningful to look up on Yahoo Finance.
// Anything else (cash, bonds, real-estate, crypto, etc.) is skipped even
// if a "ticker" string is set, since Yahoo will happily return a wrong
// match for short labels like "CASH".
const PRICEABLE_ASSET_TYPES = ["etf", "stock", "company"] as const;

export async function listPriceableInvestments() {
  await requireAuth();
  return db
    .select()
    .from(investments)
    .where(
      and(
        isNotNull(investments.ticker),
        inArray(
          sql`lower(${investments.assetType})`,
          PRICEABLE_ASSET_TYPES as unknown as string[],
        ),
      ),
    );
}

export async function setCurrentPrice(
  id: string,
  price: number,
  isoDate: string,
) {
  await requireAuth();
  await db
    .update(investments)
    .set({
      currentPrice: price,
      lastPriceUpdate: isoDate,
      updatedAt: Date.now(),
    })
    .where(eq(investments.id, id));
}
