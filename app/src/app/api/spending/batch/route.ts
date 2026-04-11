import { randomUUID } from "node:crypto";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import { merchantRules, spendeeRules, spending } from "@/db/schema";
import { mmFromIsoDate, toEuro } from "@/lib/fx";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const rowSchema = z.object({
  transaction: z.string().max(500).nullable().optional(),
  amount: z.number().finite(),
  currency: z.string().min(1).max(8),
  categoryId: z.string().uuid(),
  chargeDate: isoDate,
  moneyDate: isoDate.nullable().optional(),
  method: z.string().max(100).nullable().optional(),
  spendName: z.string().max(200).nullable().optional(),
});

const ruleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("merchant"),
    pattern: z.string().min(1).max(200),
    spendId: z.string().min(1).max(64),
  }),
  z.object({
    kind: z.literal("spendee"),
    spendeeCategory: z.string().min(1).max(200),
    spendId: z.string().min(1).max(64),
  }),
]);

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(2000),
  saveRules: z.array(ruleSchema).default([]),
});

export async function POST(request: Request) {
  return handle(async () => {
    await requireAuth();
    const body = bodySchema.parse(await request.json());
    const now = Date.now();

    const inserted = body.rows.map((r) => ({
      id: randomUUID(),
      notionId: null,
      transaction: r.transaction ?? null,
      amount: r.amount,
      currency: r.currency,
      categoryId: r.categoryId,
      chargeDate: r.chargeDate,
      moneyDate: r.moneyDate ?? null,
      method: r.method ?? null,
      mm: mmFromIsoDate(r.chargeDate),
      euroMoney: toEuro(r.amount, r.currency),
      spendName: r.spendName ?? null,
      status: null,
      createdAt: now,
      updatedAt: now,
    }));

    // One insert = one round trip. The legacy 350 ms-per-row sleep is
    // gone because Turso doesn't have Notion's rate limits.
    await db.insert(spending).values(inserted);

    let mInserted = 0;
    let sInserted = 0;
    for (const rule of body.saveRules) {
      try {
        if (rule.kind === "merchant") {
          await db.insert(merchantRules).values({
            id: randomUUID(),
            pattern: rule.pattern.toLowerCase(),
            spendId: rule.spendId,
            source: "user",
            createdAt: now,
            updatedAt: now,
          });
          mInserted++;
        } else {
          await db.insert(spendeeRules).values({
            id: randomUUID(),
            spendeeCategory: rule.spendeeCategory,
            spendId: rule.spendId,
            source: "user",
            createdAt: now,
            updatedAt: now,
          });
          sInserted++;
        }
      } catch {
        // Ignore conflicts; user probably duplicated a pattern that
        // already exists. Not worth surfacing as an error.
      }
    }

    return {
      inserted: inserted.length,
      ids: inserted.map((r) => r.id),
      newMerchantRules: mInserted,
      newSpendeeRules: sInserted,
    };
  });
}
