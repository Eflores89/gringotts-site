import { z } from "zod";
import { fail, handle } from "@/lib/api";
import {
  deleteSpending,
  getSpendingById,
  updateSpending,
} from "@/lib/db/repos/spending";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const patchSchema = z.object({
  transaction: z.string().max(500).nullable().optional(),
  amount: z.number().finite().optional(),
  currency: z.string().min(1).max(8).optional(),
  categoryId: z.string().uuid().optional(),
  chargeDate: isoDate.optional(),
  moneyDate: isoDate.nullable().optional(),
  method: z.string().max(50).nullable().optional(),
  spendName: z.string().max(200).nullable().optional(),
  status: z.string().max(32).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = await getSpendingById(id);
    if (!row) return fail("Spending entry not found", 404);
    return { spending: row };
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const row = await updateSpending(id, body);
    if (!row) return fail("Spending entry not found", 404);
    return { spending: row };
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const ok = await deleteSpending(id);
    if (!ok) return fail("Spending entry not found", 404);
    return { deleted: true };
  });
}
