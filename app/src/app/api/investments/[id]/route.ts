import { z } from "zod";
import { fail, handle } from "@/lib/api";
import {
  deleteInvestment,
  getInvestmentById,
  updateInvestment,
} from "@/lib/db/repos/investments";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  ticker: z.string().max(32).nullable().optional(),
  quantity: z.number().nullable().optional(),
  purchasePrice: z.number().nullable().optional(),
  purchaseDate: isoDate.nullable().optional(),
  currentPrice: z.number().nullable().optional(),
  currency: z.string().max(8).nullable().optional(),
  assetType: z.string().max(32).nullable().optional(),
  vestDate: isoDate.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  annualGrowthRate: z.number().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = await getInvestmentById(id);
    if (!row) return fail("Investment not found", 404);
    return { investment: row };
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const row = await updateInvestment(id, body);
    if (!row) return fail("Investment not found", 404);
    return { investment: row };
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const ok = await deleteInvestment(id);
    if (!ok) return fail("Investment not found", 404);
    return { deleted: true };
  });
}
