import { fail, handle } from "@/lib/api";
import { deleteReimbursement } from "@/lib/db/repos/reimbursements";

type Ctx = { params: Promise<{ id: string; reimbId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { reimbId } = await ctx.params;
    const ok = await deleteReimbursement(reimbId);
    if (!ok) return fail("Not found", 404);
    return { deleted: true };
  });
}
