import { z } from "zod";
import { fail, handle } from "@/lib/api";
import {
  removeInvestmentAllocation,
  updateInvestmentAllocation,
} from "@/lib/db/repos/allocations";

const patchSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  allocationType: z.enum(["industry", "geography", "fund"]).optional(),
  category: z.string().min(1).max(100).optional(),
  percentage: z.number().min(0).max(100).optional(),
});

type Ctx = { params: Promise<{ id: string; allocId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id, allocId } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const allocation = await updateInvestmentAllocation(id, allocId, body);
    return { allocation };
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id, allocId } = await ctx.params;
    const ok = await removeInvestmentAllocation(id, allocId);
    if (!ok) return fail("Allocation not linked to this investment", 404);
    return { unlinked: true };
  });
}
