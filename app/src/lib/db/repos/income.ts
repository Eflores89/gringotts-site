import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, like } from "drizzle-orm";
import { db } from "@/db/client";
import { income } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { mmFromIsoDate, toEuro } from "@/lib/fx";

export type IncomeInput = {
  description?: string | null;
  amount: number;
  currency: string;
  chargeDate: string;
  source?: string | null;
  notes?: string | null;
  fxRate?: number | null;
};

export async function listIncome(filter?: { year?: number; month?: number }) {
  await requireAuth();
  const conds = [] as Array<ReturnType<typeof eq>>;
  if (filter?.year) conds.push(like(income.chargeDate, `${filter.year}-%`));
  if (filter?.month != null) conds.push(eq(income.mm, filter.month));
  return db
    .select()
    .from(income)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(income.chargeDate), desc(income.createdAt));
}

export async function getIncomeById(id: string) {
  await requireAuth();
  const [row] = await db.select().from(income).where(eq(income.id, id));
  return row ?? null;
}

export async function createIncome(input: IncomeInput) {
  await requireAuth();
  const now = Date.now();
  const row = {
    id: randomUUID(),
    description: input.description ?? null,
    amount: input.amount,
    currency: input.currency,
    chargeDate: input.chargeDate,
    mm: mmFromIsoDate(input.chargeDate),
    euroMoney: input.fxRate
      ? input.amount * input.fxRate
      : toEuro(input.amount, input.currency),
    source: input.source ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(income).values(row);
  return row;
}

export async function updateIncome(id: string, patch: Partial<IncomeInput>) {
  await requireAuth();
  const current = await getIncomeById(id);
  if (!current) return null;
  const amount = patch.amount ?? current.amount;
  const currency = patch.currency ?? current.currency;
  const chargeDate = patch.chargeDate ?? current.chargeDate;
  const update: Record<string, unknown> = {
    updatedAt: Date.now(),
    mm: mmFromIsoDate(chargeDate),
    euroMoney: patch.fxRate
      ? amount * patch.fxRate
      : toEuro(amount, currency),
  };
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.chargeDate !== undefined) update.chargeDate = patch.chargeDate;
  if (patch.source !== undefined) update.source = patch.source;
  if (patch.notes !== undefined) update.notes = patch.notes;
  await db.update(income).set(update).where(eq(income.id, id));
  return getIncomeById(id);
}

export async function deleteIncome(id: string) {
  await requireAuth();
  const result = await db.delete(income).where(eq(income.id, id)).returning({ id: income.id });
  return result.length > 0;
}
