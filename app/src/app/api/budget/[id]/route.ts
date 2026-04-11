import { z } from "zod";
import { fail, handle } from "@/lib/api";
import {
  deleteBudget,
  getBudgetById,
  updateBudget,
} from "@/lib/db/repos/budget";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const patchSchema = z.object({
  transaction: z.string().max(500).nullable().optional(),
  amount: z.number().finite().optional(),
  currency: z.string().min(1).max(8).optional(),
  categoryId: z.string().uuid().optional(),
  chargeDate: isoDate.optional(),
  status: z.string().max(32).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = await getBudgetById(id);
    if (!row) return fail("Budget entry not found", 404);
    return { budget: row };
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const row = await updateBudget(id, body);
    if (!row) return fail("Budget entry not found", 404);
    return { budget: row };
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const ok = await deleteBudget(id);
    if (!ok) return fail("Budget entry not found", 404);
    return { deleted: true };
  });
}
