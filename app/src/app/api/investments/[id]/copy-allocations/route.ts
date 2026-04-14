import { z } from "zod";
import { handle } from "@/lib/api";
import { copyAllocationLinks } from "@/lib/db/repos/allocations";

const bodySchema = z.object({ sourceId: z.string().uuid() });

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = bodySchema.parse(await request.json());
    const copied = await copyAllocationLinks(body.sourceId, id);
    return { copied };
  });
}
