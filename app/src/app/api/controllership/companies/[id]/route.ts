import { fail, handle } from "@/lib/api";
import { deleteCompany, updateCompany } from "@/lib/db/repos/controllership";
import { companySchema } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = companySchema.partial().parse(await request.json());
    const row = await updateCompany(id, body);
    if (!row) return fail("Not found", 404);
    return { company: row };
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const ok = await deleteCompany(id);
    if (!ok) return fail("Not found", 404);
    return { deleted: true };
  });
}
