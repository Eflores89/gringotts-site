import { fail, handle } from "@/lib/api";
import {
  deleteOwnership,
  updateOwnership,
} from "@/lib/db/repos/controllership";
import { ownershipBase } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = ownershipBase.partial().parse(await request.json());
    const row = await updateOwnership(id, body);
    if (!row) return fail("Not found", 404);
    return { ownership: row };
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const ok = await deleteOwnership(id);
    if (!ok) return fail("Not found", 404);
    return { deleted: true };
  });
}
