import "server-only";
import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, spending, budget, merchantRules, spendeeRules } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export type CategoryInput = {
  name: string;
  spendName?: string | null;
  spendId?: string | null;
  spendGrp?: string | null;
  spendLifegrp?: string | null;
  status?: string | null;
};

export async function listCategories(opts?: { status?: string }) {
  await requireAuth();
  return listCategoriesPublic(opts);
}

/** No auth — used by /quick-spend to populate the category dropdown. */
export async function listCategoriesPublic(opts?: { status?: string }) {
  const where = opts?.status ? eq(categories.status, opts.status) : undefined;
  return db
    .select()
    .from(categories)
    .where(where)
    .orderBy(asc(categories.spendName), asc(categories.name));
}

export async function getCategoryById(id: string) {
  await requireAuth();
  const [row] = await db.select().from(categories).where(eq(categories.id, id));
  return row ?? null;
}

export async function createCategory(input: CategoryInput) {
  await requireAuth();
  const now = Date.now();
  const row = {
    id: randomUUID(),
    notionId: null,
    name: input.name,
    spendName: input.spendName ?? null,
    spendId: input.spendId ?? null,
    spendGrp: input.spendGrp ?? null,
    spendLifegrp: input.spendLifegrp ?? null,
    status: input.status ?? "Latest",
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(categories).values(row);
  return row;
}

export async function updateCategory(id: string, patch: Partial<CategoryInput>) {
  await requireAuth();
  const update: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.spendName !== undefined) update.spendName = patch.spendName;
  if (patch.spendId !== undefined) update.spendId = patch.spendId;
  if (patch.spendGrp !== undefined) update.spendGrp = patch.spendGrp;
  if (patch.spendLifegrp !== undefined) update.spendLifegrp = patch.spendLifegrp;
  if (patch.status !== undefined) update.status = patch.status;
  await db.update(categories).set(update).where(eq(categories.id, id));
  return getCategoryById(id);
}

export class CategoryInUseError extends Error {
  constructor(public readonly count: number) {
    super(`Category has ${count} dependent row(s)`);
    this.name = "CategoryInUseError";
  }
}

async function countOne(query: Promise<Array<{ c: number }>>): Promise<number> {
  const [row] = await query;
  return Number(row?.c ?? 0);
}

export async function deleteCategory(id: string) {
  await requireAuth();
  const target = await getCategoryById(id);
  if (!target) return false;
  const spendIdRef = target.spendId;
  const [spendingCount, budgetCount, merchantCount, spendeeCount] =
    await Promise.all([
      countOne(
        db
          .select({ c: sql<number>`count(*)` })
          .from(spending)
          .where(eq(spending.categoryId, id)),
      ),
      countOne(
        db
          .select({ c: sql<number>`count(*)` })
          .from(budget)
          .where(eq(budget.categoryId, id)),
      ),
      spendIdRef
        ? countOne(
            db
              .select({ c: sql<number>`count(*)` })
              .from(merchantRules)
              .where(eq(merchantRules.spendId, spendIdRef)),
          )
        : Promise.resolve(0),
      spendIdRef
        ? countOne(
            db
              .select({ c: sql<number>`count(*)` })
              .from(spendeeRules)
              .where(eq(spendeeRules.spendId, spendIdRef)),
          )
        : Promise.resolve(0),
    ]);
  const total = spendingCount + budgetCount + merchantCount + spendeeCount;
  if (total > 0) throw new CategoryInUseError(total);
  await db.delete(categories).where(eq(categories.id, id));
  return true;
}
