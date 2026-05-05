import { z } from "zod";
import { handle } from "@/lib/api";
import { addInvestmentAllocation } from "@/lib/db/repos/allocations";

const bodySchema = z.union([
  z.object({ existingAllocationId: z.string().uuid() }),
  z.object({
    name: z.string().max(200).nullable().optional(),
    allocationType: z.enum(["industry", "geography", "fund"]),
    category: z.string().min(1).max(100),
    percentage: z.number().min(0).max(100),
  }),
]);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = bodySchema.parse(await request.json());
    const allocation = await addInvestmentAllocation(id, body);
    return { allocation };
  });
}
