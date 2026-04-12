import "server-only";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { paymentMethods } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export async function listPaymentMethods() {
  await requireAuth();
  return db.select().from(paymentMethods).orderBy(asc(paymentMethods.name));
}

export async function getPaymentMethodById(id: string) {
  await requireAuth();
  const [row] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, id));
  return row ?? null;
}

export async function createPaymentMethod(name: string) {
  await requireAuth();
  const now = Date.now();
  const row = { id: randomUUID(), name, createdAt: now, updatedAt: now };
  await db.insert(paymentMethods).values(row);
  return row;
}

export async function updatePaymentMethod(id: string, name: string) {
  await requireAuth();
  await db.update(paymentMethods).set({ name, updatedAt: Date.now() }).where(eq(paymentMethods.id, id));
  return getPaymentMethodById(id);
}

export async function deletePaymentMethod(id: string) {
  await requireAuth();
  const result = await db.delete(paymentMethods).where(eq(paymentMethods.id, id)).returning({ id: paymentMethods.id });
  return result.length > 0;
}
