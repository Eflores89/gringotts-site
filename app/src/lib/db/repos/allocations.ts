import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  allocationInvestments,
  allocations,
  investments,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export type AllocationInput = {
  name?: string | null;
  allocationType?: string | null;
  category?: string | null;
  percentage?: number | null;
  investmentIds: string[];
};

export type AllocationFilter = {
  investmentId?: string;
  allocationType?: string;
};

export type AllocationWithLinks = {
  allocation: typeof allocations.$inferSelect;
  investmentIds: string[];
};

export async function listAllocations(
  filter: AllocationFilter = {},
): Promise<AllocationWithLinks[]> {
  await requireAuth();

  // Optionally restrict to allocations linked to a specific investment.
  let scopedIds: string[] | null = null;
  if (filter.investmentId) {
    const links = await db
      .select({ id: allocationInvestments.allocationId })
      .from(allocationInvestments)
      .where(eq(allocationInvestments.investmentId, filter.investmentId));
    scopedIds = links.map((l) => l.id);
    if (scopedIds.length === 0) return [];
  }

  const conds = [] as Array<ReturnType<typeof eq>>;
  if (filter.allocationType)
    conds.push(eq(allocations.allocationType, filter.allocationType));
  if (scopedIds) conds.push(inArray(allocations.id, scopedIds));

  const allocRows = await db
    .select()
    .from(allocations)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(allocations.allocationType), asc(allocations.category));

  if (allocRows.length === 0) return [];

  const links = await db
    .select()
    .from(allocationInvestments)
    .where(
      inArray(
        allocationInvestments.allocationId,
        allocRows.map((a) => a.id),
      ),
    );

  const linkMap = new Map<string, string[]>();
  for (const l of links) {
    const arr = linkMap.get(l.allocationId) ?? [];
    arr.push(l.investmentId);
    linkMap.set(l.allocationId, arr);
  }

  return allocRows.map((a) => ({
    allocation: a,
    investmentIds: linkMap.get(a.id) ?? [],
  }));
}

export async function getAllocationById(
  id: string,
): Promise<AllocationWithLinks | null> {
  await requireAuth();
  const [a] = await db.select().from(allocations).where(eq(allocations.id, id));
  if (!a) return null;
  const links = await db
    .select({ investmentId: allocationInvestments.investmentId })
    .from(allocationInvestments)
    .where(eq(allocationInvestments.allocationId, id));
  return { allocation: a, investmentIds: links.map((l) => l.investmentId) };
}

async function assertInvestmentsExist(ids: string[]) {
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: investments.id })
    .from(investments)
    .where(inArray(investments.id, ids));
  const found = new Set(rows.map((r) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new Error(`Unknown investment id(s): ${missing.join(", ")}`);
  }
}

export async function createAllocation(input: AllocationInput) {
  await requireAuth();
  await assertInvestmentsExist(input.investmentIds);
  const now = Date.now();
  const id = randomUUID();
  await db.insert(allocations).values({
    id,
    notionId: null,
    name: input.name ?? null,
    allocationType: input.allocationType ?? null,
    category: input.category ?? null,
    percentage: input.percentage ?? null,
    createdAt: now,
    updatedAt: now,
  });
  if (input.investmentIds.length > 0) {
    await db.insert(allocationInvestments).values(
      input.investmentIds.map((investmentId) => ({
        allocationId: id,
        investmentId,
      })),
    );
  }
  return getAllocationById(id);
}

export async function updateAllocation(
  id: string,
  patch: Partial<AllocationInput>,
) {
  await requireAuth();
  const current = await getAllocationById(id);
  if (!current) return null;

  const update: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.allocationType !== undefined)
    update.allocationType = patch.allocationType;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.percentage !== undefined) update.percentage = patch.percentage;
  await db.update(allocations).set(update).where(eq(allocations.id, id));

  if (patch.investmentIds) {
    await assertInvestmentsExist(patch.investmentIds);
    // Replace the link set wholesale.
    await db
      .delete(allocationInvestments)
      .where(eq(allocationInvestments.allocationId, id));
    if (patch.investmentIds.length > 0) {
      await db.insert(allocationInvestments).values(
        patch.investmentIds.map((investmentId) => ({
          allocationId: id,
          investmentId,
        })),
      );
    }
  }

  return getAllocationById(id);
}

export async function deleteAllocation(id: string) {
  await requireAuth();
  // allocation_investments cascades on allocations.id delete.
  const result = await db
    .delete(allocations)
    .where(eq(allocations.id, id))
    .returning({ id: allocations.id });
  return result.length > 0;
}

/**
 * Link `targetInvestmentId` to every allocation that `sourceInvestmentId`
 * is already linked to. Existing links are preserved — this only adds
 * missing ones. Returns the number of new links created.
 */
export async function copyAllocationLinks(
  sourceInvestmentId: string,
  targetInvestmentId: string,
) {
  await requireAuth();
  const sourceLinks = await db
    .select({ id: allocationInvestments.allocationId })
    .from(allocationInvestments)
    .where(eq(allocationInvestments.investmentId, sourceInvestmentId));
  if (sourceLinks.length === 0) return 0;

  const existingTargetLinks = await db
    .select({ id: allocationInvestments.allocationId })
    .from(allocationInvestments)
    .where(eq(allocationInvestments.investmentId, targetInvestmentId));
  const already = new Set(existingTargetLinks.map((l) => l.id));

  const toInsert = sourceLinks
    .filter((l) => !already.has(l.id))
    .map((l) => ({
      allocationId: l.id,
      investmentId: targetInvestmentId,
    }));

  if (toInsert.length === 0) return 0;
  await db.insert(allocationInvestments).values(toInsert);
  return toInsert.length;
}

export async function countAllocationLinks() {
  await requireAuth();
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(allocationInvestments);
  return Number(row?.c ?? 0);
}

/**
 * Add an allocation to a single investment, either by linking an existing
 * allocation row or by creating a new one. Returns the resulting allocation.
 */
export async function addInvestmentAllocation(
  investmentId: string,
  input:
    | { existingAllocationId: string }
    | {
        name?: string | null;
        allocationType: string;
        category: string;
        percentage: number;
      },
) {
  await requireAuth();
  // Confirm the investment exists upfront for a clean error.
  await assertInvestmentsExist([investmentId]);

  let allocationId: string;
  if ("existingAllocationId" in input) {
    const [existing] = await db
      .select({ id: allocations.id })
      .from(allocations)
      .where(eq(allocations.id, input.existingAllocationId));
    if (!existing) throw new Error("Allocation not found");
    allocationId = existing.id;
  } else {
    const now = Date.now();
    allocationId = randomUUID();
    await db.insert(allocations).values({
      id: allocationId,
      notionId: null,
      name: input.name ?? null,
      allocationType: input.allocationType,
      category: input.category,
      percentage: input.percentage,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Idempotent insert: ignore if the link already exists.
  const [exists] = await db
    .select({ id: allocationInvestments.allocationId })
    .from(allocationInvestments)
    .where(
      and(
        eq(allocationInvestments.allocationId, allocationId),
        eq(allocationInvestments.investmentId, investmentId),
      ),
    );
  if (!exists) {
    await db
      .insert(allocationInvestments)
      .values({ allocationId, investmentId });
  }

  return getAllocationById(allocationId);
}

/**
 * Edit an allocation as it applies to a single investment. If the underlying
 * allocation row is shared with other investments, fork: clone the row with
 * the patched values, link only this investment to the new row, and unlink
 * from the old one. Otherwise update in place. Returns the resulting
 * allocation row.
 */
export async function updateInvestmentAllocation(
  investmentId: string,
  allocationId: string,
  patch: {
    name?: string | null;
    allocationType?: string;
    category?: string;
    percentage?: number;
  },
) {
  await requireAuth();

  const [link] = await db
    .select()
    .from(allocationInvestments)
    .where(
      and(
        eq(allocationInvestments.allocationId, allocationId),
        eq(allocationInvestments.investmentId, investmentId),
      ),
    );
  if (!link) throw new Error("Allocation is not linked to this investment");

  const [current] = await db
    .select()
    .from(allocations)
    .where(eq(allocations.id, allocationId));
  if (!current) throw new Error("Allocation not found");

  const otherLinks = await db
    .select({ id: allocationInvestments.investmentId })
    .from(allocationInvestments)
    .where(eq(allocationInvestments.allocationId, allocationId));
  const sharedWithOthers = otherLinks.some(
    (l) => l.id !== investmentId,
  );

  if (!sharedWithOthers) {
    const update: Record<string, unknown> = { updatedAt: Date.now() };
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.allocationType !== undefined)
      update.allocationType = patch.allocationType;
    if (patch.category !== undefined) update.category = patch.category;
    if (patch.percentage !== undefined) update.percentage = patch.percentage;
    await db.update(allocations).set(update).where(eq(allocations.id, allocationId));
    return getAllocationById(allocationId);
  }

  // Fork: clone with patched values, link only this investment.
  const now = Date.now();
  const newId = randomUUID();
  await db.insert(allocations).values({
    id: newId,
    notionId: null,
    name: patch.name !== undefined ? patch.name : current.name,
    allocationType:
      patch.allocationType !== undefined
        ? patch.allocationType
        : current.allocationType,
    category: patch.category !== undefined ? patch.category : current.category,
    percentage:
      patch.percentage !== undefined ? patch.percentage : current.percentage,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(allocationInvestments).values({
    allocationId: newId,
    investmentId,
  });
  await db
    .delete(allocationInvestments)
    .where(
      and(
        eq(allocationInvestments.allocationId, allocationId),
        eq(allocationInvestments.investmentId, investmentId),
      ),
    );
  return getAllocationById(newId);
}

/**
 * Unlink an allocation from a single investment. Leaves the underlying
 * allocation row alive (it may still be linked to others, or sit as an
 * orphan to be cleaned up from /allocations).
 */
export async function removeInvestmentAllocation(
  investmentId: string,
  allocationId: string,
) {
  await requireAuth();
  const result = await db
    .delete(allocationInvestments)
    .where(
      and(
        eq(allocationInvestments.allocationId, allocationId),
        eq(allocationInvestments.investmentId, investmentId),
      ),
    )
    .returning({ id: allocationInvestments.allocationId });
  return result.length > 0;
}
