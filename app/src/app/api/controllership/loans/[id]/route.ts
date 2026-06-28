import { fail, handle } from "@/lib/api";
import { deleteLoan, updateLoan } from "@/lib/db/repos/controllership";
import { loanBase } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = loanBase.partial().parse(await request.json());
    const row = await updateLoan(id, body);
    if (!row) return fail("Not found", 404);
    return { loan: row };
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const ok = await deleteLoan(id);
    if (!ok) return fail("Not found", 404);
    return { deleted: true };
  });
}
