import { z } from "zod";
import { fail, handle } from "@/lib/api";
import {
  deleteAllocation,
  getAllocationById,
  updateAllocation,
} from "@/lib/db/repos/allocations";

const patchSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  allocationType: z.string().max(32).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  percentage: z.number().min(0).max(100).nullable().optional(),
  investmentIds: z.array(z.string().uuid()).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = await getAllocationById(id);
    if (!row) return fail("Allocation not found", 404);
    return { allocation: row };
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const row = await updateAllocation(id, body);
    if (!row) return fail("Allocation not found", 404);
    return { allocation: row };
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const ok = await deleteAllocation(id);
    if (!ok) return fail("Allocation not found", 404);
    return { deleted: true };
  });
}
