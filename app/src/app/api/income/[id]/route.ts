import { z } from "zod";
import { fail, handle } from "@/lib/api";
import { deleteIncome, getIncomeById, updateIncome } from "@/lib/db/repos/income";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const patchSchema = z.object({
  description: z.string().max(500).nullable().optional(),
  amount: z.number().finite().optional(),
  currency: z.string().min(1).max(8).optional(),
  chargeDate: isoDate.optional(),
  source: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  fxRate: z.number().positive().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = await getIncomeById(id);
    if (!row) return fail("Not found", 404);
    return { income: row };
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const row = await updateIncome(id, body);
    if (!row) return fail("Not found", 404);
    return { income: row };
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const ok = await deleteIncome(id);
    if (!ok) return fail("Not found", 404);
    return { deleted: true };
  });
}
