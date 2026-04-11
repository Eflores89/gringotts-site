import "server-only";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { merchantRules, spendeeRules } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

// ---------- merchant rules ----------

export type MerchantRuleInput = {
  pattern: string;
  spendId: string;
  source?: "seed" | "user";
};

export async function listMerchantRules() {
  await requireAuth();
  return db
    .select()
    .from(merchantRules)
    .orderBy(asc(merchantRules.pattern));
}

export async function getMerchantRuleById(id: string) {
  await requireAuth();
  const [row] = await db
    .select()
    .from(merchantRules)
    .where(eq(merchantRules.id, id));
  return row ?? null;
}

export async function createMerchantRule(input: MerchantRuleInput) {
  await requireAuth();
  const now = Date.now();
  const row = {
    id: randomUUID(),
    pattern: input.pattern.toLowerCase(),
    spendId: input.spendId,
    source: input.source ?? "user",
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(merchantRules).values(row);
  return row;
}

export async function updateMerchantRule(
  id: string,
  patch: Partial<MerchantRuleInput>,
) {
  await requireAuth();
  const update: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.pattern !== undefined) update.pattern = patch.pattern.toLowerCase();
  if (patch.spendId !== undefined) update.spendId = patch.spendId;
  if (patch.source !== undefined) update.source = patch.source;
  await db.update(merchantRules).set(update).where(eq(merchantRules.id, id));
  return getMerchantRuleById(id);
}

export async function deleteMerchantRule(id: string) {
  await requireAuth();
  const result = await db
    .delete(merchantRules)
    .where(eq(merchantRules.id, id))
    .returning({ id: merchantRules.id });
  return result.length > 0;
}

// ---------- spendee rules ----------

export type SpendeeRuleInput = {
  spendeeCategory: string;
  spendId: string;
  source?: "seed" | "user";
};

export async function listSpendeeRules() {
  await requireAuth();
  return db
    .select()
    .from(spendeeRules)
    .orderBy(asc(spendeeRules.spendeeCategory));
}

export async function getSpendeeRuleById(id: string) {
  await requireAuth();
  const [row] = await db
    .select()
    .from(spendeeRules)
    .where(eq(spendeeRules.id, id));
  return row ?? null;
}

export async function createSpendeeRule(input: SpendeeRuleInput) {
  await requireAuth();
  const now = Date.now();
  const row = {
    id: randomUUID(),
    spendeeCategory: input.spendeeCategory,
    spendId: input.spendId,
    source: input.source ?? "user",
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(spendeeRules).values(row);
  return row;
}

export async function updateSpendeeRule(
  id: string,
  patch: Partial<SpendeeRuleInput>,
) {
  await requireAuth();
  const update: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.spendeeCategory !== undefined)
    update.spendeeCategory = patch.spendeeCategory;
  if (patch.spendId !== undefined) update.spendId = patch.spendId;
  if (patch.source !== undefined) update.source = patch.source;
  await db.update(spendeeRules).set(update).where(eq(spendeeRules.id, id));
  return getSpendeeRuleById(id);
}

export async function deleteSpendeeRule(id: string) {
  await requireAuth();
  const result = await db
    .delete(spendeeRules)
    .where(eq(spendeeRules.id, id))
    .returning({ id: spendeeRules.id });
  return result.length > 0;
}
