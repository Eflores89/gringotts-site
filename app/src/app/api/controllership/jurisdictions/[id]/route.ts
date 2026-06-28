import { fail, handle } from "@/lib/api";
import {
  deleteJurisdiction,
  updateJurisdiction,
} from "@/lib/db/repos/controllership";
import { jurisdictionSchema } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = jurisdictionSchema.partial().parse(await request.json());
    const row = await updateJurisdiction(id, body);
    if (!row) return fail("Not found", 404);
    return { jurisdiction: row };
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const ok = await deleteJurisdiction(id);
    if (!ok) return fail("Not found", 404);
    return { deleted: true };
  });
}
